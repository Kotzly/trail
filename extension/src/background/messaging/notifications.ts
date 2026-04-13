import type { NodeId, TabId } from "@shared/types/ids.js";
import { tabManager } from "../state/tab-manager.js";
import type { TabSoundState, TabState } from "@shared/types/tabs.js";
import {
  type TreeUpdateReason,
  type TreeViewIntent,
} from "@shared/rpc/contracts.js";
import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { NavigationTree } from "../state/nav-tree.js";
import { browser } from "@shared/platform/webext.js";
import {
  createLayoutCacheKey,
  getActiveLayoutCacheContext,
  getCachedPositions,
  precompute,
  type LayoutPositions,
} from "../services/layout-precompute.js";
import { settingsManager } from "../services/settings.js";
import { createLogger } from "@shared/lib/logger.js";
import {
  EXTENSION_MESSAGE,
  fireExtensionEvent,
} from "@shared/transport/extension-messaging.js";
import type { TreesSnapshot } from "@shared/rpc/contracts.js";

const log = createLogger("notifications");

export async function getTabStates(): Promise<Record<NodeId, TabState>> {
  const tabStates: Record<NodeId, TabState> = {};
  const allTabs = await browser.tabs.query({});

  for (const tab of allTabs) {
    if (tab.id === undefined) continue;
    const nodeId = tabManager.nodeByTab(tab.id as TabId);
    if (!nodeId) continue;
    const soundState: TabSoundState = {
      muted: tab.mutedInfo?.muted || false,
      audible: tab.audible || false,
    };
    tabStates[nodeId] = { sound: soundState };
  }

  return tabStates;
}

let viewIntentCounter = 0;

const DEBOUNCE_MS = 200;
const IMMEDIATE_REASONS: Set<string> = new Set([
  "set-current",
  "tree-switch",
  "tree-reset",
  "layout",
  "delete",
  "undo",
  "pins",
  "tags",
  "reparent",
  "duplicate",
  "editor-enter",
  "editor-exit",
]);

const STRUCTURAL_REASONS: Set<TreeUpdateReason> = new Set([
  "navigate",
  "tree-switch",
  "tree-reset",
  "delete",
  "undo",
  "reparent",
  "duplicate",
  "layout",
]);

type PendingNotification = {
  treeJSON: NavigationTreeJSON;
  reason: TreeUpdateReason;
  view?: TreeViewIntent;
};

type TreeNotificationOptions = {
  positions?: LayoutPositions | null;
  skipPrecompute?: boolean;
};

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingArgs: PendingNotification | null = null;

async function loadCachedPositionsForActiveTree(): Promise<LayoutPositions | null> {
  try {
    const settings = settingsManager.get();
    const context = await getActiveLayoutCacheContext(settings);
    return await getCachedPositions(context);
  } catch (error) {
    log.warn("Failed to load cached layout positions", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function requestLayoutRefinement(treeJSON: NavigationTreeJSON): void {
  void (async () => {
    try {
      const settings = settingsManager.get();
      const context = await getActiveLayoutCacheContext(settings);
      const { positions, applied } = await precompute(treeJSON, settings, context);
      if (!applied) return;

      const latestContext = await getActiveLayoutCacheContext(settingsManager.get());
      if (createLayoutCacheKey(latestContext) !== createLayoutCacheKey(context)) {
        return;
      }

      await sendTreeNotification(treeJSON, "layout", undefined, {
        positions,
        skipPrecompute: true,
      });
    } catch (error) {
      log.warn("Late layout refinement failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}

async function sendTreeNotification(
  treeJSON: NavigationTreeJSON,
  reason: TreeUpdateReason,
  view?: TreeViewIntent,
  options: TreeNotificationOptions = {},
): Promise<void> {
  const openNodes = Array.from(tabManager.openNodes());
  const tabStates = await getTabStates();

  const nodeTabCounts = Object.fromEntries(
    openNodes.map((nodeId) => [nodeId, tabManager.tabCountForNode(nodeId)]),
  );
  const nodeRecency: Record<string, number> = {};
  for (const nodeId of openNodes) {
    const recency = tabManager.getNodeRecency(nodeId);
    if (recency > 0) nodeRecency[nodeId] = recency;
  }

  const nextView = view
    ? { ...view, intentId: view.intentId ?? (viewIntentCounter += 1) }
    : undefined;

  const positions =
    options.positions === undefined && !STRUCTURAL_REASONS.has(reason)
      ? await loadCachedPositionsForActiveTree()
      : (options.positions ?? null);

  fireExtensionEvent(EXTENSION_MESSAGE.TREE_UPDATED, {
    tree: treeJSON,
    openNodeIds: openNodes,
    tabStates,
    nodeTabCounts,
    nodeRecency,
    reason,
    ...(nextView ? { view: nextView } : {}),
    ...(positions ? { positions } : {}),
  });

  if (STRUCTURAL_REASONS.has(reason) && !options.skipPrecompute) {
    requestLayoutRefinement(treeJSON);
  }
}

export async function notifyTreeUpdate(
  tree: NavigationTree,
  reason: TreeUpdateReason = "navigate",
  view?: TreeViewIntent,
): Promise<void> {
  const treeJSON = NavigationTreeMapper.toJSON(tree);

  if (IMMEDIATE_REASONS.has(reason)) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
      pendingArgs = null;
    }
    return sendTreeNotification(treeJSON, reason, view);
  }

  pendingArgs = { treeJSON, reason, ...(view ? { view } : {}) };
  if (!debounceTimer) {
    debounceTimer = setTimeout(async () => {
      const args = pendingArgs;
      pendingArgs = null;
      debounceTimer = null;
      if (args) {
        await sendTreeNotification(args.treeJSON, args.reason, args.view);
      }
    }, DEBOUNCE_MS);
  }
}

export async function notifyTreesUpdate(snapshot: TreesSnapshot): Promise<void> {
  fireExtensionEvent(EXTENSION_MESSAGE.TREES_UPDATED, snapshot);
}
