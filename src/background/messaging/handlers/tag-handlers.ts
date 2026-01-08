import type { NodeId, Tag } from '../../../shared/types/ids.js';
import { treeStorage } from '../../services/tree-storage.js';
import { notifyTreeUpdate } from '../notifications.js';

export async function handleTagMessage(
  message: any,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  const tree = await treeStorage.getTree();
  
  switch (message.type) {
    case 'SET_TAGS': {
      // Set all tags for a node
      const { nodeId, tags } = message;
      const node = tree.findNodeById(nodeId);
      if (node) {
        node.data.tags = tags as Tag[];
        await treeStorage.saveTree(tree);
        await notifyTreeUpdate(tree);
        return { success: true };
      } else {
        return { success: false, error: 'Node not found' };
      }
    }
    
    case 'ADD_TAG': {
      // Add a single tag to a node
      const { nodeId, tagId } = message;
      const node = tree.findNodeById(nodeId);
      if (node) {
        if (!node.data.tags.includes(tagId as Tag)) {
          node.data.tags.push(tagId as Tag);
        }
        await treeStorage.saveTree(tree);
        await notifyTreeUpdate(tree);
        return { success: true };
      } else {
        return { success: false, error: 'Node not found' };
      }
    }
    
    case 'REMOVE_TAG': {
      // Remove a single tag from a node
      const { nodeId, tagId } = message;
      const node = tree.findNodeById(nodeId);
      if (node) {
        node.data.tags = node.data.tags.filter((t: Tag) => t !== tagId);
        await treeStorage.saveTree(tree);
        await notifyTreeUpdate(tree);
        return { success: true };
      } else {
        return { success: false, error: 'Node not found' };
      }
    }
    
    default:
      return { success: false, error: 'Unknown tag message type' };
  }
}
