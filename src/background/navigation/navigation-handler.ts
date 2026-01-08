import { now, UrlWithTimestamp, type TabId, type Url } from '../../shared/types/ids.js';
import type { NodeData } from '../../shared/types/node.js';
import { tabManager } from '../state/tab-manager.js';
import { treeStorage } from '../services/tree-storage.js';
import { settingsManager } from '../services/settings.js';
import { redirectDetector } from './redirect-detection.js';
import { createNode } from '../utils/tree-utils.js';
import { getFaviconUrl, shouldTrackUrl } from '../utils/url-utils.js';
import { notifyTreeUpdate } from '../messaging/notifications.js';

/**
 * Handle navigation events and add to tree.
 * Always uses multi-tab mode.
 */
export async function handleNavigation(
  details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
  transitionType?: string
): Promise<void> {
  const { tabId, url, frameId } = details;

  // Only track main frame navigations
  if (frameId !== 0) return;

  // Skip ignored URLs
  if (!shouldTrackUrl(url as Url)) return;

  // Get tab to determine window
  let windowId: number;
  try {
    const tab = await chrome.tabs.get(tabId);
    windowId = tab.windowId;
  } catch (e) {
    return; // Tab no longer exists
  }
  
  // Skip blank/undefined URLs - just track for redirect detection, don't create nodes
  if (!url || url === 'about:blank') {
    redirectDetector.recordTabUrl(tabId as TabId, { url: (url || 'about:blank') as Url, timestamp: now() } as UrlWithTimestamp);
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    const settings = settingsManager.get();
    
    // CRITICAL: Only update currentNode if this tab is active (user navigated)
    // If tab is not active, it was created programmatically - don't switch focus
    const isActiveTab = tab.active;
    
    // Track whether we create a new node (vs reusing existing)
    let wasNewNodeCreated = false;

    // Track URL for about:blank redirect detection
    const prevUrlData = redirectDetector.recordTabUrl(tabId as TabId, { url: url as Url, timestamp: now() } as UrlWithTimestamp);
    const isFromBlankUrl = !prevUrlData || prevUrlData.url === 'about:blank';

    // Check if this tab is already registered to a node (global)
    const existingNodeId = tabManager.nodeByTab(tabId as TabId);

    const data: NodeData = {
      url: url as Url,
      title: (tab.title || url) as any,
      favicon: (tab.favIconUrl || getFaviconUrl(url as Url)) as any,
      pinned: false, // todo: check pinned.
      tags: [],
      collapsed: false,
    };

    // Use GLOBAL tree - shared across all windows
    const tree = await treeStorage.getTree();

    if (existingNodeId !== undefined) {
      // Tab already has a node
      const node = tree.findNodeById(existingNodeId);
      if (node && node.data.url !== url) {
        // Different URL
        
          // Normal behavior: navigate from current node (creates child)
          // Only update currentNode if tab is active (user navigated)
          if (tab.active) {
            tree.setCurrentById(existingNodeId);
          }
          const newNode = tree.navigate(data);
          wasNewNodeCreated = true; // New node was created
          // Re-register tab with new node (global) - this automatically unregisters from old node
          tabManager.register(newNode.id, tabId as TabId);
          // Update currentNode to new node only if tab is active
          if (tab.active) {
            tree.setCurrentById(newNode.id);
          }
          // Update tab counts immediately after re-registration (even if tab is inactive)
          // This ensures "New Tab" counter decreases immediately when tab navigates away
          await treeStorage.saveTree(tree);
          await notifyTreeUpdate(tree);
      } else if (node) {
        // Same URL - only update current if tab is active
        if (tab.active) {
          tree.setCurrentById(existingNodeId);
        }
      }
      tabManager.touch(tabId as TabId, existingNodeId);
    } else {
      // New tab without existing node
      let newNode;

      // First, try to find existing node with this URL globally
      let existingNodeInWindow = tree.findByUrl(url as Url);

      // If found existing node, use it instead of creating new
      if (existingNodeInWindow) {
        newNode = existingNodeInWindow;
        // Only update currentNode if tab is active (user navigated, not programmatic)
        if (isActiveTab) {
          tree.setCurrentById(newNode.id);
        }
        // Register this tab with the existing node - this automatically unregisters from old node if any
        tabManager.register(newNode.id, tabId as TabId);
        // Update tab counts immediately after registration (even if tab is inactive)
        // This ensures "New Tab" counter decreases immediately when tab navigates to existing node
        await treeStorage.saveTree(tree);
        await notifyTreeUpdate(tree);
      } else {
          newNode = tree.navigate(data);
        
        // Update tab counts immediately after registration (even if tab is inactive)
        // This ensures "New Tab" counter decreases immediately when tab navigates to new node
        await treeStorage.saveTree(tree);
        await notifyTreeUpdate(tree);
      }
    

      // Check tab limit (global, skip pinned nodes)
      // await tabManager.closeOldestGlobalIfNeeded(settings.maxOpenTabs, tree); // todo: implement LRU in tab manager
    }

    await treeStorage.saveTree(tree);
    
    // Only notify if tab is active OR if we created a new node (not just reused existing)
    // This prevents unnecessary UI updates for programmatic tab creation
    // For inactive tabs, only notify if a new node was actually created
    if (isActiveTab || wasNewNodeCreated) {
      await notifyTreeUpdate(tree);
    }
  } catch (error) {
    console.debug('Navigation error:', error);
  }
}
