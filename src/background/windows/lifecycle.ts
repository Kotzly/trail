import type { TabId } from '../../shared/types/ids';
import { tabManager } from '../state/tab-manager';
import { treeStorage } from '../services/tree-storage';
import { getPendingNodeForWindow, setPendingNodeForWindow, getPendingNodeForTab } from './window-state';
import { createNodeInSingleTree } from '../utils/tree-utils';
import { ensureNodeForTab } from '../utils/node-utils';
import { notifyGlobalTreeUpdate } from '../messaging/notifications';
import type { TreeEntry } from '../../shared/types/node';

/**
 * Initialize window lifecycle event listeners.
 */
export function initWindowsLifecycle(): void {
  /**
   * Cleanup when window is closed.
   * For global mode: unregister tabs from that window but keep tree.
   */
  chrome.windows.onRemoved.addListener(async (windowId) => {
    // Tabs from this window are cleaned up via tabs.onRemoved; no extra work needed.
  });

  /**
   * Handle new window creation - create new root in global tree.
   */
  chrome.windows.onCreated.addListener(async (window) => {
    try {
      // Always multi-tab mode - create new root for new window
      // Get the first tab in the new window
      const tabs = await chrome.tabs.query({ windowId: window.id });
      if (tabs.length === 0) return;
      
      const tab = tabs[0];
      if (tab.id === undefined) return;
      
      const tabUrl = (tab.pendingUrl || tab.url || '') as any;

      // If this window is created from a detached tab, reuse its node
      const detNodeId = getPendingNodeForTab(tab.id as TabId);
      if (detNodeId !== undefined) {
        const tree = await treeStorage.getGlobalTree();
        const root = tree.findRootForNode(detNodeId);
        if (root) {
          (root as any).windowId = window.id;
        }
        tabManager.register(detNodeId, tab.id as TabId);
        tree.setCurrentById(detNodeId);
        await treeStorage.saveGlobalTree(tree);
        await notifyGlobalTreeUpdate(tree);
        return;
      }

      // If any tab in this window is already mapped to a node, don't create another root
      for (const t of tabs) {
        if (t.id === undefined) continue;
        const mapped = tabManager.nodeByTab(t.id as TabId);
        if (mapped !== undefined) {
          // Ensure owner window is set
          const tree = await treeStorage.getGlobalTree();
          const root = tree.findRootForNode(mapped);
          if (root && (root as any).windowId !== window.id) {
            (root as any).windowId = window.id;
            await treeStorage.saveGlobalTree(tree);
          }
          return;
        }
      }

      // If this window is intended to host an existing node, just register it
      const pendingNodeId = getPendingNodeForWindow(window.id);
      if (pendingNodeId !== undefined) {
        const tree = await treeStorage.getGlobalTree();
        const root = tree.findRootForNode(pendingNodeId);
        if (root) {
          (root as any).windowId = window.id;
        }
        tabManager.register(pendingNodeId, tab.id as TabId);
        tree.setCurrentById(pendingNodeId);
        await treeStorage.saveGlobalTree(tree);
        await notifyGlobalTreeUpdate(tree);
        return;
      }

      // Register tab in single tree
      const tree = await treeStorage.getGlobalTree();
      const entry: TreeEntry = {
        url: tabUrl || ('about:blank' as any),
        title: (tab.title || '') as any,
        favicon: (tab.favIconUrl || '') as any,
      };
      const node = createNodeInSingleTree(tree, entry);
      if (node) {
        tabManager.register(node.id, tab.id as TabId);
        await treeStorage.saveGlobalTree(tree);
        await notifyGlobalTreeUpdate(tree);
      }
    } catch (error) {
      console.debug('Error creating root for new window:', error);
    }
  });
}
