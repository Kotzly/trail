import type { NodeId, Tag } from '../../../shared/types/ids';
import { treeStorage } from '../../services/tree-storage';
import { notifyGlobalTreeUpdate } from '../notifications';

export async function handleTagMessage(
  message: any,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  const tree = await treeStorage.getGlobalTree();
  
  switch (message.type) {
    case 'SET_TAGS': {
      // Set all tags for a node
      const { nodeId, tags } = message;
      const node = tree.findNodeByIdDFS(nodeId);
      if (node) {
        node.tags = tags as Tag[];
        await treeStorage.saveGlobalTree(tree);
        await notifyGlobalTreeUpdate(tree);
        return { success: true };
      } else {
        return { success: false, error: 'Node not found' };
      }
    }
    
    case 'ADD_TAG': {
      // Add a single tag to a node
      const { nodeId, tagId } = message;
      const node = tree.findNodeByIdDFS(nodeId);
      if (node) {
        if (!node.tags.includes(tagId as Tag)) {
          node.tags.push(tagId as Tag);
        }
        await treeStorage.saveGlobalTree(tree);
        await notifyGlobalTreeUpdate(tree);
        return { success: true };
      } else {
        return { success: false, error: 'Node not found' };
      }
    }
    
    case 'REMOVE_TAG': {
      // Remove a single tag from a node
      const { nodeId, tagId } = message;
      const node = tree.findNodeByIdDFS(nodeId);
      if (node) {
        node.tags = node.tags.filter(t => t !== tagId);
        await treeStorage.saveGlobalTree(tree);
        await notifyGlobalTreeUpdate(tree);
        return { success: true };
      } else {
        return { success: false, error: 'Node not found' };
      }
    }
    
    default:
      return { success: false, error: 'Unknown tag message type' };
  }
}
