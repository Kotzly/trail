import type { TabId, NodeId } from '../../shared/types/ids.js';
import { tabManager } from '../state/tab-manager.js';
import type { TabSoundState, TabState } from '../../shared/types/tabs.js';
import { msg } from '../../shared/types/messages.js';
import { treeStorage } from '../services/tree-storage.js';
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

export async function notifyTreeUpdate(tree: NavigationTree): Promise<void> {
    const openNodes = Array.from(tabManager.openNodes());
    const tabStates = await getTabStates();
    
    const nodeTabCounts = Object.fromEntries(openNodes.map(nodeId => [nodeId, tabManager.tabCountForNode(nodeId)]));

    return chrome.runtime.sendMessage(msg.treeUpdated({
        tree: NavigationTreeMapper.toJSON(tree),
        openNodeIds: openNodes,
        tabStates: tabStates,
        nodeTabCounts: nodeTabCounts,
    }));
}