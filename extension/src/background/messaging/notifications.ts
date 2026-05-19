import type { NodeId, TabId } from "@shared/types/ids.js";
import { tabManager } from "../state/tab-manager.js";
import type { TabSoundState, TabState } from "@shared/types/tabs.js";
import type { TreeUpdateReason, TreeViewIntent, TreesSnapshot } from "@shared/rpc/contracts.js";
import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { NavigationTree } from "../state/nav-tree.js";
import { browser } from "@shared/platform/webext.js";
import {
  computePositions,
  createLayoutCacheKey,
  getActiveLayoutCacheContext,
  getCachedPositions,
  persistComputedPositions,
  precompute,
  type LayoutPositions,
} from "../services/layout-precompute.js";
import { settingsManager } from "../services/settings.js";
import { createLogger } from "@shared/lib/logger.js";
import { captureError } from "@shared/lib/observability.js";
import { CommandManager } from "@shared/lib/commands.js";
import { EXTENSION_MESSAGE, fireExtensionEvent } from "@shared/transport/extension-messaging.js";

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

// Seeded from wall-clock on module load so successive SW wakes don't
// collide with intent IDs issued in a prior SW lifetime (closes P3.11).
let viewIntentCounter = Date.now();

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
  // Added in the tree-tracking overhaul (#85, #86). These all
  // correspond to user-observable events; a 200ms debounce was
  // producing visible lag (rename dialog closed but tree still
  // showed old title, click-to-navigate felt sluggish).
  "navigate",
  "rename",
  "tabs",
  "temp-selection",
  "sync",
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
};

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingArgs: PendingNotification | null = null;

async function persistInlinePositions(positions: LayoutPositions): Promise<void> {
  try {
    const settings = settingsManager.get();
    const context = await getActiveLayoutCacheContext(settings);
    await persistComputedPositions(positions, context);
  } catch (error) {
    log.warn("Failed to persist inline-computed positions", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

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

/**
 * True when every node in `tree` has a corresponding entry in `positions`.
 * Used to skip stale cached positions after a mutation — savedAt only bumps
 * on the debounced save (~1.5s), so just-added nodes would otherwise ship
 * with no position and render at (0, 0) until the next snapshot arrives.
 */
function positionsCoverTree(tree: NavigationTreeJSON, positions: LayoutPositions): boolean {
  if (!tree.root) return true;
  const stack = [tree.root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (!Object.prototype.hasOwnProperty.call(positions, String(node.id))) {
      return false;
    }
    for (const child of node.children) stack.push(child);
  }
  return true;
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

  // Compute positions synchronously inline so the first TREE_UPDATED
  // already carries final coordinates. Previously this path emitted a
  // positions=null message and scheduled a `requestLayoutRefinement`
  // that pushed a second TREE_UPDATED ~one tick later — every tree
  // mutation thus cost two `applyTreeState`s on the sidepanel, each
  // re-deriving the full 1800+ node array. Going inline cuts post-
  // mutation jank in half on big trees. d3 Reingold–Tilford for ~5k
  // nodes is ~30–80ms; acceptable on the SW side vs. the duplicate
  // sidepanel render it replaces.
  let positions: LayoutPositions | null;
  let computedInline = false;
  if (options.positions !== undefined) {
    positions = options.positions;
  } else {
    const cached = STRUCTURAL_REASONS.has(reason) ? null : await loadCachedPositionsForActiveTree();
    if (cached && positionsCoverTree(treeJSON, cached)) {
      positions = cached;
    } else if (treeJSON.root) {
      const settings = settingsManager.get();
      positions = computePositions(treeJSON, settings);
      computedInline = positions !== null;
    } else {
      positions = null;
    }
  }

  fireExtensionEvent(EXTENSION_MESSAGE.TREE_UPDATED, {
    tree: treeJSON,
    openNodeIds: openNodes,
    tabStates,
    nodeTabCounts,
    nodeRecency,
    reason,
    ...(nextView ? { view: nextView } : {}),
    ...(positions ? { positions } : {}),
    commandState: CommandManager.getState(),
  });

  // Fire-and-forget cache persistence so the next snapshot read hits
  // the cache. Detached from the send so it can't block, and so a
  // stale-context check inside the persist doesn't double-fire.
  if (computedInline && positions) {
    void persistInlinePositions(positions);
  }

  // Opportunistic sync push — no-op when signed out or sync not configured.
  if (!STRUCTURAL_ONLY_REASONS.has(reason)) {
    // Lazy-require to avoid importing the full sync engine at module init
    // time (service worker cold-start can take longer with extra work).
    void import("../sync/sync-engine.js")
      .then(({ schedulePush }) => schedulePush())
      .catch((error) => {
        // Silent swallow previously dropped every post-nav push when the
        // sync chunk failed to load (e.g. after a botched update).
        // Surface it so we can notice in prod.
        captureError(error, {
          surface: "background",
          kind: "notifications_sync_import",
        });
      });
  }
}

// Reasons that don't produce a new tree content state that's worth syncing.
// Layout-only updates shouldn't trip a push — the server payload is still the
// same tree; client-local positions are not synced.
const STRUCTURAL_ONLY_REASONS = new Set<TreeUpdateReason>(["layout", "temp-selection"]);

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

  // Merge `view` with the pending args — do NOT replace wholesale.
  // If caller A queued a view-intent (e.g. focus-to-node) and caller B
  // debounce-coalesced without a view, B's args shouldn't drop A's
  // view. Fixes #91.
  pendingArgs = {
    treeJSON,
    reason,
    ...(view ? { view } : pendingArgs?.view ? { view: pendingArgs.view } : {}),
  };
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
