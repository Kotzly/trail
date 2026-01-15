import type { TabId, NodeId } from '../../shared/types/ids.js';
import { tabManager } from '../state/tab-manager.js';
import type { TabSoundState, TabState } from '../../shared/types/tabs.js';
import { msg, type TreeUpdateReason, type TreeViewIntent, type TreesSnapshot } from '../../shared/types/messages.js';
import { NavigationTreeMapper } from '../../shared/lib/mapper.js';
import { NavigationTree } from '../state/nav-tree.js';


// Get tab states for all open tabs.
export async function getTabStates(): Promise<Record<NodeId, TabState>> {
  const tabStates: Record<NodeId, TabState> = {};
  const allTabs = await chrome.tabs.query({});
  
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

export async function notifyTreeUpdate(
  tree: NavigationTree,
  reason: TreeUpdateReason = 'sync',
  view?: TreeViewIntent,
): Promise<void> {
  console.log('notifyTreeUpdate', reason);
    // INSERT_YOUR_CODE
    // Log the calling function name, if possible.
    const err = new Error();
    if (err.stack) {
        const stackLines = err.stack.split('\n');
        // stackLines[0] is 'Error', stackLines[1] is this function, stackLines[2] is the caller
        if (stackLines.length > 2) {
            const callerLine = stackLines[2]!.trim();
            console.log('notifyTreeUpdate called by:', callerLine);
        }
        else {
            console.log('notifyTreeUpdate called by:', 'unknown');
        }
    } else {
      console.log("err not stack")
    }
    const openNodes = Array.from(tabManager.openNodes());
    const tabStates = await getTabStates();
    
    const nodeTabCounts = Object.fromEntries(openNodes.map(nodeId => [nodeId, tabManager.tabCountForNode(nodeId)]));
    const nextView = view
      ? { ...view, intentId: view.intentId ?? (viewIntentCounter += 1) }
      : undefined;

    const payload = msg.treeUpdated({
        tree: NavigationTreeMapper.toJSON(tree),
        openNodeIds: openNodes,
        tabStates: tabStates,
        nodeTabCounts: nodeTabCounts,
        reason,
        ...(nextView ? { view: nextView } : {}),
    });

    chrome.runtime.sendMessage(payload);
}

export async function notifyTreesUpdate(snapshot: TreesSnapshot): Promise<void> {
  const payload = msg.treesUpdated(snapshot);
  chrome.runtime.sendMessage(payload);
}
