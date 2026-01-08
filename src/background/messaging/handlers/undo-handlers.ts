import { treeStorage } from '../../services/tree-storage';
import { CommandManager } from '../../../shared/lib/commands';
import { TreeNodeMapper } from '../../../shared/lib/mapper';
import { NavigationTree } from '../../state/nav-tree';
import { notifyGlobalTreeUpdate } from '../notifications';

export async function handleUndoMessage(
  message: any,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  const tree = await treeStorage.getGlobalTree();
  const root = tree.getRoot();
  const currentTreeJSON = {
    root: root ? TreeNodeMapper.rootToJSON(root) : null,
    currentNodeId: tree.getCurrentId(),
    capacity: 1000,
    nodeCount: tree.size(),
  };
  
  switch (message.type) {
    case 'UNDO': {
      const previousState = CommandManager.undo(currentTreeJSON);
      
      if (previousState) {
        // Restore tree from snapshot
        const restoredTree = new NavigationTree(1000);
        if (previousState.root) {
          const rootNode = TreeNodeMapper.rootFromJSON(previousState.root);
          if (rootNode) {
            (restoredTree as any).root = rootNode;
            (restoredTree as any).current = rootNode;
            if (previousState.currentNodeId) {
              const current = findNodeById(rootNode, previousState.currentNodeId);
              if (current) {
                (restoredTree as any).current = current;
              }
            }
          }
        }
        await treeStorage.saveGlobalTree(restoredTree);
        await notifyGlobalTreeUpdate(restoredTree);
        return { success: true, state: CommandManager.getState() };
      } else {
        return { success: false, error: 'Nothing to undo' };
      }
    }
    
    case 'REDO': {
      const nextState = CommandManager.redo(currentTreeJSON);
      
      if (nextState) {
        // Restore tree from snapshot
        const restoredTree = new NavigationTree(1000);
        if (nextState.root) {
          const rootNode = TreeNodeMapper.rootFromJSON(nextState.root);
          if (rootNode) {
            (restoredTree as any).root = rootNode;
            (restoredTree as any).current = rootNode;
            if (nextState.currentNodeId) {
              const current = findNodeById(rootNode, nextState.currentNodeId);
              if (current) {
                (restoredTree as any).current = current;
              }
            }
          }
        }
        await treeStorage.saveGlobalTree(restoredTree);
        await notifyGlobalTreeUpdate(restoredTree);
        return { success: true, state: CommandManager.getState() };
      } else {
        return { success: false, error: 'Nothing to redo' };
      }
    }
    
    case 'GET_UNDO_STATE': {
      return { success: true, state: CommandManager.getState() };
    }
    
    default:
      return { success: false, error: 'Unknown undo message type' };
  }
}

function findNodeById(node: any, id: number): any {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}
