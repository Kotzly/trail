import type { TabId, NodeId } from '../../../shared/types/ids.js';
import { tabManager } from '../../state/tab-manager.js';
import { notifyTreeUpdate } from '../notifications.js';
import { treeStorage } from '../../services/tree-storage.js';

export async function handleTabMessage(
  message: any,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  switch (message.type) {
    case 'TOGGLE_MUTE': {
      // Toggle mute state for a tab by nodeId
      const { nodeId } = message;
      const tabsForNode = tabManager.tabsByNode(nodeId);
      if (tabsForNode.size > 0) {
        const tabId = Array.from(tabsForNode)[0];
        try {
          const tab = await chrome.tabs.get(tabId!);
          const newMuted = !tab.mutedInfo?.muted;
          await chrome.tabs.update(tabId!, { muted: newMuted });
          return { success: true, muted: newMuted };
        } catch (e) {
          return { success: false, error: (e as Error).message };
        }
      } else {
        return { success: false, error: 'Tab not found' };
      }
    }
    
    case 'CLOSE_TAB': {
      // Close tab for a node
      const { nodeId } = message;
      const tabsForNode = tabManager.tabsByNode(nodeId);
      if (tabsForNode.size > 0) {
        const tabId = Array.from(tabsForNode)[0];
        try {
          await chrome.tabs.remove(tabId!);
          return { success: true };
        } catch (e) {
          return { success: false, error: (e as Error).message };
        }
      } else {
        return { success: false, error: 'Tab not found' };
      }
    }
    
    case 'BULK_CLOSE_TABS': {
      // Close tabs for multiple nodes (without removing from tree)
      const { nodeIds } = message;
      let closedCount = 0;
      
      for (const id of nodeIds) {
        const tabsForNode = tabManager.tabsByNode(id);
        for (const tabId of tabsForNode) {
          try {
            await chrome.tabs.remove(tabId!);
            tabManager.unregister(tabId);
            closedCount++;
          } catch (e) {
            // Tab might already be closed
          }
        }
      }
      
      // Notify update
      const tree = await treeStorage.getTree();
      await notifyTreeUpdate(tree);
      return { success: true, closedCount };
    }
    
    case 'GET_TAB_FOR_NODE': {
      // Get tab info for a node (used by context menu)
      const { nodeId } = message;
      
      const tabsForNode = tabManager.tabsByNode(nodeId);
      if (tabsForNode.size > 0) {
        const tabId = Array.from(tabsForNode)[0];
        try {
          const tab = await chrome.tabs.get(tabId!);
          return { success: true, tabInfo: tab };
        } catch (e) {
          // Tab no longer exists
          tabManager.unregister(tabId!);
          return { success: true, tabInfo: null };
        }
      } else {
        return { success: true, tabInfo: null };
      }
    }
    
    case 'GET_CURRENT_TAB': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return { success: true, tab };
    }
    
    default:
      return { success: false, error: 'Unknown tab message type' };
  }
}
