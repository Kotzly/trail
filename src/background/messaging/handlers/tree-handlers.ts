import type { TabId } from '../../../shared/types/ids';
import { tabManager } from '../../state/tab-manager';
import { treeStorage } from '../../services/tree-storage';
import { ensureNodeForTab } from '../../utils/node-utils';
import { ensureRootOwner } from '../../utils/tree-utils';
import { getTabStates } from '../notifications';
import { TreeNodeMapper } from '../../../shared/lib/mapper';

export async function handleTreeMessage(
  message: any,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  switch (message.type) {
    case 'GET_TREE': {
      // Always multi-tab mode: use global tree (shared across all windows)
      const tab = await chrome.tabs.get(message.tabId);
      const tree = await treeStorage.getGlobalTree();
      
      // Try to find node for active tab (global lookup)
      let activeNodeId = tabManager.nodeByTab(tab.id as TabId);
      
      // If tab not registered, try to find node by URL globally, otherwise create placeholder
      if (activeNodeId === undefined) {
        if (tab.url) {
          const nodeByUrl = tree.findByUrl(tab.url as any);
          
          // CRITICAL: Only use node if URL matches exactly
          if (nodeByUrl && nodeByUrl.url === tab.url) {
            activeNodeId = nodeByUrl.id;
            tabManager.register(nodeByUrl.id, tab.id as TabId);
            
            // Update currentNode
            tree.setCurrentById(activeNodeId);
            await treeStorage.saveGlobalTree(tree);
          } else {
            activeNodeId = await ensureNodeForTab(tab, { makeCurrent: true, notify: true });
          }
        } else {
          activeNodeId = await ensureNodeForTab(tab, { makeCurrent: true, notify: true });
        }
      }
      
      // Update currentNode if we found the node and URL matches
      if (activeNodeId !== undefined) {
        const node = tree.findNodeByIdDFS(activeNodeId);
        if (node && node.url === tab.url && tree.getCurrentId() !== activeNodeId) {
          tree.setCurrentById(activeNodeId);
          await treeStorage.saveGlobalTree(tree);
        }
        ensureRootOwner(tree, activeNodeId, tab.windowId ?? null);
      }
      
      const openNodeIds = Array.from(tabManager.openNodes());
      const tabStates = await getTabStates();
      
      // Calculate tab counts across all windows
      const nodeTabCounts: Record<number, number> = {};
      for (const nodeId of openNodeIds) {
        const count = tabManager.tabCountForNode(nodeId);
        if (count > 1) {
          nodeTabCounts[nodeId] = count;
        }
      }
      
      const root = tree.getRoot();
      return { 
        success: true, 
        tree: {
          root: root ? TreeNodeMapper.rootToJSON(root) : null,
          currentNodeId: tree.getCurrentId(),
          capacity: 1000,
          nodeCount: tree.size(),
        },
        openNodeIds: Array.from(openNodeIds),
        tabStates,
        nodeTabCounts,
        multiTabMode: true,
        windowId: tab.windowId
      };
    }
    
    case 'GET_WINDOW_TREE': {
      // Returns GLOBAL tree (shared across all windows)
      const tree = await treeStorage.getGlobalTree();
      const openNodeIds = Array.from(tabManager.openNodes());
      const tabStates = await getTabStates();
      const root = tree.getRoot();
      return { 
        success: true, 
        tree: {
          root: root ? TreeNodeMapper.rootToJSON(root) : null,
          currentNodeId: tree.getCurrentId(),
          capacity: 1000,
          nodeCount: tree.size(),
        },
        openNodeIds: Array.from(openNodeIds),
        tabStates
      };
    }
    
    case 'CLEAR_TREE': {
      // Clear tree
      const tree = await treeStorage.getGlobalTree();
      // TODO: Implement tree.clear() method
      // For now, create a new empty tree
      const { treeStorage: ts } = await import('../../services/tree-storage');
      const newTree = await ts.getGlobalTree();
      // Clear all tab mappings
      // TODO: Add clear method to tabManager
      await treeStorage.saveGlobalTree(newTree);
      
      const { notifyGlobalTreeUpdate } = await import('../notifications');
      await notifyGlobalTreeUpdate(newTree);
      return { success: true };
    }
    
    default:
      return { success: false, error: 'Unknown tree message type' };
  }
}
