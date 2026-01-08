import type { TabId, NodeId } from '../../../shared/types/ids';
import { tabManager } from '../../state/tab-manager';
import { treeStorage } from '../../services/tree-storage';
import { settingsManager } from '../../services/settings';
import { notifyTreeUpdate } from '../notifications';

export async function handleNavigationMessage(
  message: any,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  switch (message.type) {
    case 'NAVIGATE_TO': {
      const { windowId, nodeId, url, tabId } = message;
      const settings = settingsManager.get();
      
      const tree = await treeStorage.getTree();
      
      // Get tabs for this node
      const nodeTabs = tabManager.tabsByNode(nodeId);
      const tabsArray = Array.from(nodeTabs);
      
      // Cycle through open tabs for this node (across all windows)
      if (tabsArray.length > 1 && tabId) {
        const nextTab = tabManager.getNextTabForNode(nodeId, tabId as TabId);
        if (nextTab) {
          try {
            // Get window ID for the tab
            const tab = await chrome.tabs.get(nextTab);
            await chrome.windows.update(tab.windowId!, { focused: true });
            await chrome.tabs.update(nextTab, { active: true });
            tabManager.touch(nextTab, nodeId);
            tree.setCurrentById(nodeId);
            await treeStorage.saveTree(tree);
            await notifyTreeUpdate(tree);
            return { success: true };
          } catch (e) {
            // Tab may have closed; fall through to open logic
          }
        }
      }
      
      // Try focusing an existing tab for this node
      if (tabsArray.length > 0) {
        const existingTabId = tabsArray[0];
        try {
          const tab = await chrome.tabs.get(existingTabId as TabId);
          await chrome.windows.update(tab.windowId!, { focused: true });
          await chrome.tabs.update(existingTabId, { active: true });
          tabManager.touch(existingTabId as TabId, nodeId);
          tree.setCurrentById(nodeId);
          await treeStorage.saveTree(tree);
          await notifyTreeUpdate(tree);
          return { success: true };
        } catch (e) {
          tabManager.unregister(existingTabId as TabId);
        }
      }
      
      // If no tab is open, create one in owning window (or new window)
      if (tabsArray.length === 0) {
        let targetWindowId = windowId;
        let targetWindowExists = false;
        if (targetWindowId) {
          try {
            await chrome.windows.get(targetWindowId);
            targetWindowExists = true;
          } catch (e) {
            targetWindowExists = false;
          }
        }
        
        if (!targetWindowExists) {
          const node = tree.findNodeById(nodeId);
          if (!node) return { success: false, error: 'Node not found' };
          
          const newWindow = await chrome.windows.create({ focused: true, url: node.data.url });
          targetWindowId = newWindow?.id;
          const tabs = await chrome.tabs.query({ windowId: newWindow?.id });
          const newTab = tabs[0];
          if (newTab && newTab.id) {
            tabManager.register(nodeId, newTab.id as TabId);
          }
        } else {
          const node = tree.findNodeById(nodeId);
          if (!node) return { success: false, error: 'Node not found' };
          
          const newTab = await chrome.tabs.create({ windowId: targetWindowId, url: node.data.url, active: true });
          tabManager.register(nodeId, newTab.id! as TabId);
        }
        
        // Enforce tab limit globally (skip pinned nodes) // todo: implement with LRU eviction policy
        // await tabManager.closeOldestGlobalIfNeeded(settings.maxOpenTabs, tree);
      }
      
      // Update current node in tree
      tree.setCurrentById(nodeId);
      await treeStorage.saveTree(tree);
      await notifyTreeUpdate(tree);
      
      return { success: true };
    }
    
    case 'OPEN_IN_CURRENT_TAB': {
      // Open URL in the current active tab
      const { url } = message;
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.id) {
        await chrome.tabs.update(activeTab.id, { url });
      }
      return { success: true };
    }
    
    case 'OPEN_IN_NEW_TAB': {
      // Open node URL in a new tab (background, don't switch focus)
      const { nodeId } = message;
      const tree = await treeStorage.getTree();
      const node = tree.findNodeById(nodeId);
      if (node) {
        // Mark as programmatic BEFORE creating tab to prevent auto-focus
        const tab = await chrome.tabs.create({ url: node.data.url, active: false });
        
        // Always multi-tab mode
        tabManager.register(nodeId, tab.id! as TabId);
        // DO NOT update currentNode - keep focus on current tab
        // But DO notify to update tab count badge immediately
        await treeStorage.saveTree(tree);
        await notifyTreeUpdate(tree);
        return { success: true };
      } else {
        return { success: false, error: 'Node not found' };
      }
    }
    
    case 'OPEN_NEW_TAB': {
      // Used by content script in multi-tab mode
      const { url, windowId } = message;
      const newTab = await chrome.tabs.create({ windowId, url, active: true });
      return { success: true, tabId: newTab.id };
    }
    
    default:
      return { success: false, error: 'Unknown navigation message type' };
  }
}
