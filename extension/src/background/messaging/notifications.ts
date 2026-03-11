import type { TabId, NodeId } from '@shared/types/ids.js';
import { tabManager } from '../state/tab-manager.js';
import type { TabSoundState, TabState } from '@shared/types/tabs.js';
import { rpc, type TreeUpdateReason, type TreeViewIntent, type TreesSnapshot } from '@shared/rpc/contracts.js';
import { NavigationTreeMapper } from '@shared/lib/mapper.js';
import { NavigationTree } from '../state/nav-tree.js';
import { sendRuntimeMessage } from './send-message.js';
import { browser } from '@shared/platform/webext.js';
import { spotlightLiveIndex } from '../services/spotlight-live-index.js';


// Get tab states for all open tabs.
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
    const tabState: TabState = {
      sound: soundState,
    };
    tabStates[nodeId] = tabState;
  }

  return tabStates;
}

let viewIntentCounter = 0;

// ---------------------------------------------------------------------------
// Debounce for navigate/sync reasons to batch redirect chains
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 200;
const IMMEDIATE_REASONS: ReadonlySet<TreeUpdateReason> = new Set<TreeUpdateReason>([
  'set-current',
  'tree-switch',
  'tree-reset',
  'layout',
  'delete',
  'undo',
  'pins',
  'tags',
  'reparent',
  'duplicate',
  'editor-enter',
  'editor-exit',
]);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingArgs: { tree: NavigationTree; reason: TreeUpdateReason; view?: TreeViewIntent } | null = null;

async function sendTreeNotification(
  tree: NavigationTree,
  reason: TreeUpdateReason,
  view?: TreeViewIntent,
): Promise<void> {
  const openNodes = Array.from(tabManager.openNodes());
  const tabStates = await getTabStates();

  const nodeTabCounts = Object.fromEntries(openNodes.map(nodeId => [nodeId, tabManager.tabCountForNode(nodeId)]));
  const nodeRecency: Record<string, number> = {};
  for (const nodeId of openNodes) {
    const r = tabManager.getNodeRecency(nodeId);
    if (r > 0) nodeRecency[nodeId] = r;
  }
  const nextView = view
    ? { ...view, intentId: view.intentId ?? (viewIntentCounter += 1) }
    : undefined;

  const payload = rpc.treeUpdated({
      tree: NavigationTreeMapper.toJSON(tree),
      openNodeIds: openNodes,
      tabStates: tabStates,
      nodeTabCounts: nodeTabCounts,
      nodeRecency,
      reason,
      ...(nextView ? { view: nextView } : {}),
  });

  sendRuntimeMessage(payload);
}

export async function notifyTreeUpdate(
  tree: NavigationTree,
  reason: TreeUpdateReason = 'sync',
  view?: TreeViewIntent,
): Promise<void> {
  spotlightLiveIndex.invalidate();
  if (IMMEDIATE_REASONS.has(reason)) {
    // Flush any pending debounced update, then send immediately
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
      pendingArgs = null;
    }
    return sendTreeNotification(tree, reason, view);
  }

  // Debounce: keep latest args, send after DEBOUNCE_MS of quiet
  pendingArgs = { tree, reason, ...(view ? { view } : {}) };
  if (!debounceTimer) {
    debounceTimer = setTimeout(async () => {
      const args = pendingArgs;
      pendingArgs = null;
      debounceTimer = null;
      if (args) await sendTreeNotification(args.tree, args.reason, args.view);
    }, DEBOUNCE_MS);
  }
}

export async function notifyTreesUpdate(snapshot: TreesSnapshot): Promise<void> {
  spotlightLiveIndex.invalidate();
  const payload = rpc.treesUpdated(snapshot);
  sendRuntimeMessage(payload);
}
