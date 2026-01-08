import type { NodeId } from '../../../shared/types/ids';
import { tabManager } from '../../state/tab-manager';
import { treeStorage } from '../../services/tree-storage';
import { CommandManager } from '../../../shared/lib/commands';
import { notifyGlobalTreeUpdate } from '../notifications';
import { TreeNodeMapper } from '../../../shared/lib/mapper';

export async function handleNodeMessage(
  message: any,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  const tree = await treeStorage.getGlobalTree();
  
  switch (message.type) {
    case 'DELETE_NODE': {
      const { nodeId } = message;
      
      // Save snapshot for undo
      const root = tree.getRoot();
      CommandManager.saveSnapshot({
        root: root ? TreeNodeMapper.rootToJSON(root) : null,
        currentNodeId: tree.getCurrentId(),
        capacity: 1000,
        nodeCount: tree.size(),
      }, 'Delete node');
      
      // TODO: Implement removeNodesAndReconnect in NavigationTree
      // For now, return error
      return { success: false, error: 'Delete node not yet implemented' };
    }
    
    case 'DELETE_CHILDREN': {
      const { nodeId } = message;
      
      // Save snapshot for undo
      const root = tree.getRoot();
      CommandManager.saveSnapshot({
        root: root ? TreeNodeMapper.rootToJSON(root) : null,
        currentNodeId: tree.getCurrentId(),
        capacity: 1000,
        nodeCount: tree.size(),
      }, 'Delete children');
      
      // TODO: Implement removeChildren in NavigationTree
      return { success: false, error: 'Delete children not yet implemented' };
    }
    
    case 'DELETE_WITH_CHILDREN': {
      const { nodeId } = message;
      
      // Save snapshot for undo
      const root = tree.getRoot();
      CommandManager.saveSnapshot({
        root: root ? TreeNodeMapper.rootToJSON(root) : null,
        currentNodeId: tree.getCurrentId(),
        capacity: 1000,
        nodeCount: tree.size(),
      }, 'Delete with children');
      
      // TODO: Implement removeNodeWithChildren in NavigationTree
      return { success: false, error: 'Delete with children not yet implemented' };
    }
    
    case 'BULK_DELETE': {
      const { nodeIds } = message;
      
      // Save snapshot for undo
      const root = tree.getRoot();
      CommandManager.saveSnapshot({
        root: root ? TreeNodeMapper.rootToJSON(root) : null,
        currentNodeId: tree.getCurrentId(),
        capacity: 1000,
        nodeCount: tree.size(),
      }, 'Delete selected');
      
      // TODO: Implement bulk delete
      return { success: false, error: 'Bulk delete not yet implemented' };
    }
    
    case 'REMOVE_NODE': {
      const { nodeId } = message;
      
      // TODO: Implement removeNode in NavigationTree
      // Close any tabs bound to this node
      const tabsForNode = tabManager.tabsByNode(nodeId);
      for (const tabId of tabsForNode) {
        try {
          await chrome.tabs.remove(tabId);
        } catch (e) {
          // Tab already closed
        }
        tabManager.unregister(tabId);
      }
      
      await treeStorage.saveGlobalTree(tree);
      await notifyGlobalTreeUpdate(tree);
      return { success: true };
    }
    
    default:
      return { success: false, error: 'Unknown node message type' };
  }
}
