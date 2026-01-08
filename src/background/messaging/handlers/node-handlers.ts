import type { NodeId } from '../../../shared/types/ids';
import { tabManager } from '../../state/tab-manager';
import { treeStorage } from '../../services/tree-storage';
import { CommandManager } from '../../../shared/lib/commands';
import { notifyTreeUpdate } from '../notifications';
import { TreeNodeMapper } from '../../../shared/lib/mapper';

export async function handleNodeMessage(
  message: any,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  const tree = await treeStorage.getTree();
  
  switch (message.type) {
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
      
      await treeStorage.saveTree(tree);
      await notifyTreeUpdate(tree);
      return { success: true };
    }
    
    default:
      return { success: false, error: 'Unknown node message type' };
  }
}
