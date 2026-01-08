import type { TabId, Url } from '../../shared/types/ids';
import type { TreeEntry } from '../../shared/types/node';
import { tabManager } from '../state/tab-manager';
import { treeStorage } from '../services/tree-storage';
import { settingsManager } from '../services/settings';
import { programmaticTabs } from '../state/programmatic-tabs';
import { redirectDetector } from './redirect-detection';
import { createNode } from '../utils/tree-utils';
import { getFaviconUrl, shouldTrackUrl } from '../utils/url-utils';
import { notifyGlobalTreeUpdate } from '../messaging/notifications';

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
  
  // Always use multi-tab mode
  await handleMultiTabNavigation(details, transitionType, windowId);
}

/**
 * Handle navigation in multi-tab mode.
 * Uses GLOBAL tree - all windows share the same graph.
 * Each node maps to exactly one tab in one window.
 */
export async function handleMultiTabNavigation(
  details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
  transitionType: string | undefined,
  windowId: number
): Promise<void> {
  const { tabId, url } = details;

  // Skip blank/undefined URLs - just track for redirect detection, don't create nodes
  if (!url || url === 'about:blank') {
    redirectDetector.recordTabUrl(tabId as TabId, { url: (url || 'about:blank') as Url, timestamp: Date.now() });
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
    const prevUrlData = redirectDetector.recordTabUrl(tabId as TabId, { url: url as Url, timestamp: Date.now() });
    const isFromBlankUrl = !prevUrlData || prevUrlData.url === 'about:blank';

    // Check if this tab is already registered to a node (global)
    const existingNodeId = tabManager.nodeByTab(tabId as TabId);

    const entry: TreeEntry = {
      url: url as Url,
      title: (tab.title || url) as any,
      favicon: (tab.favIconUrl || getFaviconUrl(url as Url)) as any,
    };

    // Use GLOBAL tree - shared across all windows
    const tree = await treeStorage.getTree();

    if (existingNodeId !== undefined) {
      // Tab already has a node
      const node = tree.findNodeByIdDFS(existingNodeId);
      if (node && node.url !== url) {
        // Different URL
        
        // Check if this is a pinned tab in sync mode - update in place instead of creating child
        if (settings.pinSyncBrowser && node.pinned) {
          // Pinned tab: update the node in place (acts as a "slot")
          node.url = url as Url;
          node.title = entry.title;
          node.favicon = entry.favicon;
          node.timestamp = Date.now() as any;
          // Only update currentNode if tab is active (user navigated)
          if (tab.active) {
            tree.setCurrentById(existingNodeId);
          }
        } else {
          // Normal behavior: navigate from current node (creates child)
          // Only update currentNode if tab is active (user navigated)
          if (tab.active) {
            tree.setCurrentById(existingNodeId);
          }
          const newNode = tree.navigate(entry, { backOnRevisit: true });
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
          await notifyGlobalTreeUpdate(tree);
        }
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
        programmaticTabs.recordRegistration(tabId as TabId);
        // Update tab counts immediately after registration (even if tab is inactive)
        // This ensures "New Tab" counter decreases immediately when tab navigates to existing node
        await treeStorage.saveTree(tree);
        await notifyGlobalTreeUpdate(tree);
      } else {
        // Check if this is a redirect
        const isRedirect = programmaticTabs.isRedirect(tabId as TabId) || isFromBlankUrl;

        // Single tree: create under existing root (unless redirect)
        if (!isRedirect) {
          // Single tree: create under existing root
          newNode = createNode(tree, entry);
        } else {
          // Redirect: branch from current node (backOnRevisit always enabled)
          const current = tree.getCurrent();
          if (current) {
            tree.setCurrent(current);
            newNode = tree.navigate(entry, { backOnRevisit: true });
          } else {
            newNode = createNode(tree, entry);
          }
        }
        
        if (!newNode) return;
        
        wasNewNodeCreated = true; // New node was created

        // Register globally (nodeId -> {windowId, tabId}) - this automatically unregisters from old node if any
        tabManager.register(newNode.id, tabId as TabId);
        programmaticTabs.recordRegistration(tabId as TabId);
        
        // Only update currentNode if tab is active (user navigated, not programmatic)
        if (isActiveTab) {
          tree.setCurrentById(newNode.id);
        }
        // Update tab counts immediately after registration (even if tab is inactive)
        // This ensures "New Tab" counter decreases immediately when tab navigates to new node
        await treeStorage.saveTree(tree);
        await notifyGlobalTreeUpdate(tree);
      }
      
      // Sync browser tab pin state to node (only in pinSyncBrowser mode)
      if (settings.enablePinNodes && settings.pinSyncBrowser && newNode) {
        try {
          const tab = await chrome.tabs.get(tabId);
          if (tab.pinned) {
            newNode.pinned = true;
          }
        } catch (e) {
          // Tab might be closed
        }
      }

      // Cleanup old entries from recentTabRegistrations
      programmaticTabs.cleanup();

      // Check tab limit (global, skip pinned nodes)
      await tabManager.closeOldestGlobalIfNeeded(settings.maxOpenTabs, tree);
    }

    await treeStorage.saveTree(tree);
    
    // Only notify if tab is active OR if we created a new node (not just reused existing)
    // This prevents unnecessary UI updates for programmatic tab creation
    // For inactive tabs, only notify if a new node was actually created
    if (isActiveTab || wasNewNodeCreated) {
      await notifyGlobalTreeUpdate(tree);
    }
  } catch (error) {
    console.debug('Multi-tab navigation error:', error);
  }
}
