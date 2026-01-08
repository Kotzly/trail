import type { NodeId } from '../../../shared/types/ids';
import { tabManager } from '../../state/tab-manager';
import { treeStorage } from '../../services/tree-storage';
import { settingsManager } from '../../services/settings';
import { notifyGlobalTreeUpdate } from '../notifications';

export async function handlePinMessage(
  message: any,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  const tree = await treeStorage.getGlobalTree();
  const settings = settingsManager.get();
  
  switch (message.type) {
    case 'TOGGLE_PIN': {
      // Toggle pinned state for a node
      const { nodeId } = message;
      
      const node = tree.findNodeByIdDFS(nodeId);
      if (!node) {
        return { success: false, error: 'Node not found' };
      }
      
      // Always toggle just this node
      const newPinned = !node.pinned;
      node.pinned = newPinned;
      
      // Mode A: also sync with browser tab pin
      if (settings.pinSyncBrowser) {
        const tabsForNode = tabManager.tabsByNode(nodeId);
        if (tabsForNode.size > 0) {
          const tabId = Array.from(tabsForNode)[0];
          try {
            await chrome.tabs.update(tabId, { pinned: newPinned });
          } catch (e) {
            // Tab might be closed
          }
        }
      }
      
      await treeStorage.saveGlobalTree(tree);
      await notifyGlobalTreeUpdate(tree);
      return { success: true, pinned: newPinned };
    }
    
    case 'BULK_PIN': {
      // Pin multiple nodes
      const { nodeIds } = message;
      let pinnedCount = 0;
      
      for (const id of nodeIds) {
        const node = tree.findNodeByIdDFS(id);
        if (node && !node.pinned) {
          node.pinned = true;
          pinnedCount++;
        }
      }
      
      await treeStorage.saveGlobalTree(tree);
      await notifyGlobalTreeUpdate(tree);
      return { success: true, pinnedCount };
    }
    
    case 'BULK_UNPIN': {
      // Unpin multiple nodes
      const { nodeIds } = message;
      let unpinnedCount = 0;
      
      for (const id of nodeIds) {
        const node = tree.findNodeByIdDFS(id);
        if (node && node.pinned) {
          node.pinned = false;
          unpinnedCount++;
        }
      }
      
      await treeStorage.saveGlobalTree(tree);
      await notifyGlobalTreeUpdate(tree);
      return { success: true, unpinnedCount };
    }
    
    default:
      return { success: false, error: 'Unknown pin message type' };
  }
}
