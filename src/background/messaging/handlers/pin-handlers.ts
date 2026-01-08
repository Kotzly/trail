import type { NodeId } from '../../../shared/types/ids.js';
import { tabManager } from '../../state/tab-manager.js';
import { treeStorage } from '../../services/tree-storage.js';
import { settingsManager } from '../../services/settings.js';
import { notifyTreeUpdate } from '../notifications.js';

export async function handlePinMessage(
  message: any,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  const tree = await treeStorage.getTree();
  const settings = settingsManager.get();
  
  switch (message.type) {
    case 'TOGGLE_PIN': {
      // Toggle pinned state for a node
      const { nodeId } = message;
      
      const node = tree.findNodeById(nodeId);
      if (!node) {
        return { success: false, error: 'Node not found' };
      }
      
      // Always toggle just this node
      const newPinned = !node.data.pinned;
      node.data.pinned = newPinned;
      

      await treeStorage.saveTree(tree);
      await notifyTreeUpdate(tree);
      return { success: true, pinned: newPinned };
    }
    
    case 'BULK_PIN': {
      // Pin multiple nodes
      const { nodeIds } = message;
      let pinnedCount = 0;
      
      for (const id of nodeIds) {
        const node = tree.findNodeById(id);
        if (node && !node.data.pinned) {
          node.data.pinned = true;
          pinnedCount++;
        }
      }
      
      await treeStorage.saveTree(tree);
      await notifyTreeUpdate(tree);
      return { success: true, pinnedCount };
    }
    
    case 'BULK_UNPIN': {
      // Unpin multiple nodes
      const { nodeIds } = message;
      let unpinnedCount = 0;
      
      for (const id of nodeIds) {
        const node = tree.findNodeById(id);
        if (node && node.data.pinned) {
          node.data.pinned = false;
          unpinnedCount++;
        }
      }
      
      await treeStorage.saveTree(tree);
      await notifyTreeUpdate(tree);
      return { success: true, unpinnedCount };
    }
    
    default:
      return { success: false, error: 'Unknown pin message type' };
  }
}
