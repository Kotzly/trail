import {
  type TreeUpdatedInput,
  type TreesSnapshot,
  type TreeViewIntent,
} from "@shared/rpc/contracts.js";
import { CommandManager } from "@shared/lib/commands.js";
import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import { createLogger } from "@shared/lib/logger.js";
import type { Description, NodeId, TabId } from "@shared/types/ids.js";
import type { ForEacher } from "@shared/types/foreach.js";
import { tabManager } from "../../state/tab-manager.js";
import { treeStorage } from "../../services/tree-storage.js";
import { settingsManager } from "../../services/settings.js";
import {
  computePositions,
  getActiveLayoutCacheContext,
  getCachedPositions,
  persistComputedPositions,
  positionsCoverTree,
} from "../../services/layout-precompute.js";
import { browser } from "@shared/platform/webext.js";
import { getTabStates } from "../notifications.js";
import type { NavigationTree } from "../../state/nav-tree.js";

const log = createLogger("tree-handlers");

/**
 * Save a snapshot of the current tree to the undo history.
 */
export function snapshot(tree: NavigationTree, description: string): void {
  CommandManager.saveSnapshot(NavigationTreeMapper.toJSON(tree), description as Description);
}

/**
 * Re-point any tabs that were attached to merged-away nodes onto the
 * surviving (redirect target) nodes. Used by delete flows that collapse
 * a node into a sibling/parent.
 */
export function reassignTabsForRedirects(redirects: Array<{ from: NodeId; to: NodeId }>): void {
  for (const redirect of redirects) {
    if (redirect.from === redirect.to) continue;
    const tabs = [...tabManager.tabsByNode(redirect.from)];
    for (const tabId of tabs) {
      tabManager.register(redirect.to, tabId as TabId, { touch: true });
    }
  }
}

/**
 * Compute a focus intent that points at the new current node if the
 * delete changed it. Returns undefined when current didn't move (so the
 * sidepanel keeps whatever focus it had).
 */
export function getDeleteFocusView(
  tree: NavigationTree,
  prevCurrentId: NodeId | null,
): TreeViewIntent | undefined {
  const nextCurrentId = tree.getCurrentId();
  if (!nextCurrentId || nextCurrentId === prevCurrentId) return undefined;
  return { focusNodeId: nextCurrentId, mode: "force" };
}

/**
 * Collect a unique list of tab ids attached to any of the given nodes.
 */
export function collectTabIdsForNodes(nodeIds: ForEacher<NodeId>): TabId[] {
  const tabIds: TabId[] = [];
  nodeIds.forEach((nodeId) => {
    tabManager.tabsByNode(nodeId).forEach((tabId) => tabIds.push(tabId as TabId));
  });
  return Array.from(new Set(tabIds));
}

/**
 * Close a batch of browser tabs. Logs errors and returns whether the
 * close succeeded so the caller can decide on follow-up state cleanup.
 */
export async function closeTabs(tabIds: TabId[], context: string): Promise<boolean> {
  if (tabIds.length === 0) return true;
  try {
    await browser.tabs.remove(tabIds);
    return true;
  } catch (error) {
    log.error("Failed to close tabs", {
      context,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Convenience: collect-then-close. Used by delete handlers after the
 * tree mutation to drop the corresponding browser tabs.
 */
export async function closeTabsForNodes(nodeIds: ForEacher<NodeId>): Promise<void> {
  const tabIds = collectTabIdsForNodes(nodeIds);
  await closeTabs(tabIds, "nodes");
}

/**
 * Build the full TreeUpdatedInput payload sent to the sidepanel on
 * GET_TREE. Inline-computes positions on cache miss so the first
 * applyTreeState already has final coordinates.
 */
export async function buildTreeSnapshot(): Promise<TreeUpdatedInput> {
  const openNodes = Array.from(tabManager.openNodes());
  const nodeRecency: Record<string, number> = {};
  for (const nodeId of openNodes) {
    const r = tabManager.getNodeRecency(nodeId);
    if (r > 0) nodeRecency[nodeId] = r;
  }
  const settings = settingsManager.get();
  const [tree, tabStates] = await Promise.all([treeStorage.getOrCreateTree(), getTabStates()]);
  const treeJSON = NavigationTreeMapper.toJSON(tree);

  // Inline-compute positions on cache miss so the sidepanel's first
  // applyTreeState already has final coordinates. The async-refinement
  // path that ran here previously cost the sidepanel an extra full
  // `applyTreeState` (1800-node displayNodes re-derivation, React Flow
  // diff) per tree snapshot — visible as back-to-back ~90ms long-tasks
  // in the DevTools timeline after every navigation/new-tab.
  let positions: Awaited<ReturnType<typeof getCachedPositions>> = null;
  let cacheContext: Awaited<ReturnType<typeof getActiveLayoutCacheContext>> | null = null;
  try {
    cacheContext = await getActiveLayoutCacheContext(settings);
    positions = await getCachedPositions(cacheContext);
  } catch (error) {
    log.warn("Failed to load cached positions for tree snapshot", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // savedAt only bumps on the debounced save (~1.5s after cacheTree),
  // so just-added nodes are usually missing in the cache. Compute
  // inline rather than shipping positions=null and triggering the
  // async refinement push.
  if (positions && !positionsCoverTree(treeJSON, positions)) {
    positions = null;
  }

  if (!positions && treeJSON.root) {
    positions = computePositions(treeJSON, settings);
    if (positions && cacheContext) {
      // Persist for the next snapshot; fire-and-forget so this call
      // doesn't block returning the snapshot to the sidepanel.
      void persistComputedPositions(positions, cacheContext);
    }
  }

  const snapshot: TreeUpdatedInput = {
    tree: treeJSON,
    openNodeIds: openNodes,
    tabStates,
    nodeTabCounts: Object.fromEntries(
      openNodes.map((nodeId) => [nodeId, tabManager.tabCountForNode(nodeId)]),
    ),
    nodeRecency,
    reason: "sync",
    ...(positions ? { positions } : {}),
    commandState: CommandManager.getState(),
  };
  return snapshot;
}

/**
 * Build the `{ active, others }` snapshot used by `TREES_UPDATED`.
 * Reads both halves in parallel — they have no interdependency.
 */
export async function buildTreesSnapshot(): Promise<TreesSnapshot> {
  // Called 7× per mutation handler; `active` and `others` have no
  // interdependency — parallelize both reads.
  const [active, others] = await Promise.all([
    treeStorage.getActiveMeta(),
    treeStorage.getStoredSummaries(),
  ]);
  return { active, others };
}
