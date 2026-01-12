import type { NodeId, TabId } from '../../../shared/types/ids.js';
import { MSG, defineHandlers } from '../../../shared/types/messages.js';
import { tabManager } from '../../state/tab-manager.js';
import { notifyTreeUpdate } from '../notifications.js';
import { treeStorage } from '../../services/tree-storage.js';
import { ok, err } from '../../../shared/types/messages.js';
import { NavigationTree } from '../../state/nav-tree.js';



export const tabHandlers = defineHandlers({
  async [MSG.GET_TABS_FOR_NODE](message) {
    const tabs: chrome.tabs.Tab[] = [];
    const tabsForNode = tabManager.tabsByNode(message.nodeId);

    tabsForNode.forEach(async (tabId) => {
      chrome.tabs.get(tabId as TabId).catch(console.error).then((tab) => tab ? tabs.push(tab) : tabManager.unregister(tabId as TabId));
    });

    return ok({ tabs });
  },

  async [MSG.TOGGLE_MUTE](message) {
    const { nodeId, tabId } = message;

    const tabsForNode = tabManager.tabsByNode(nodeId);
    if (!tabsForNode?.has(tabId)) return err('Tab not found');

    try {
      const tab = await chrome.tabs.get(tabId);
      const newMuted = !tab.mutedInfo?.muted;
      await chrome.tabs.update(tabId, { muted: newMuted });
      return ok();
    } catch (e) {
      return err((e as Error).message);
    }
  },

  async [MSG.CLOSE_TAB](message) {
    const { nodeId, tabId } = message;
    const tabsForNode = tabManager.tabsByNode(nodeId);
    if (!tabsForNode?.has(tabId)) return err('Tab not found');

    const tree = await treeStorage.getOrCreateTree();
    try {
      await chrome.tabs.remove(tabId);
      await unregisterTabForNode(tree, nodeId, tabId);
      await notifyTreeUpdate(tree, 'tabs');
      return ok();
    } catch (e) {
      return err((e as Error).message);
    }
  },

  async [MSG.BULK_CLOSE_TABS](message) {
    const tree = await treeStorage.getOrCreateTree();
    const { nodeIds } = message;
    nodeIds.forEach(async (nodeId) => {
      tabManager.tabsByNode(nodeId).forEach(async (tabId) => {
        chrome.tabs.remove(tabId).catch(console.error).then(async () => await unregisterTabForNode(tree, nodeId, tabId));
      })
    })
   
    await notifyTreeUpdate(tree, 'tabs');
    return ok();
  },
});

async function unregisterTabForNode(tree: NavigationTree, nodeId: NodeId, tabId: TabId): Promise<void> {
  tabManager.unregister(tabId);
  if (tabManager.tabCountForNode(nodeId) === 0) {
    await notifyTreeUpdate(tree, 'tabs');
  }
}
