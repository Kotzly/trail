import { now, UrlWithTimestamp, type TabId, type Title, type Url } from '../../shared/types/ids.js';
import { NodeMetaPatch, updateNodeMeta, type NodeData } from '../../shared/types/node.js';
import { tabManager } from '../state/tab-manager.js';
import { treeStorage } from '../services/tree-storage.js';
import { redirectDetector } from './redirect-detection.js';
import { normalizeFaviconUrl, shouldTrackUrl } from '../utils/url-utils.js';
import { notifyTreeUpdate } from '../messaging/notifications.js';
import { NavigationTreeMapper } from '../../shared/lib/mapper.js';
import { CommandManager } from '../../shared/lib/commands.js';
import type { Description } from '../../shared/types/ids.js';

/**
 * Handle navigation events and add to tree.
 * Always uses multi-tab mode.
 */
export async function handleNavigation(
  details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
  _transitionType?: string
): Promise<void> {
  const { tabId, url, frameId } = details;

  // Only track main frame navigations
  if (frameId !== 0) return;

  // Skip ignored URLs
  if (!shouldTrackUrl(url as Url)) return;

  // Ensure tab still exists
  try {
    await chrome.tabs.get(tabId);
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
    // CRITICAL: Only update currentNode if this tab is active (user navigated)
    // If tab is not active, it was created programmatically - don't switch focus
    const isActiveTab = tab.active;
    
    // Track whether we create a new node (vs reusing existing)
    let wasNewNodeCreated = false;
    let didUpdateCurrent = false;

    // Track URL for about:blank redirect detection
    redirectDetector.recordTabUrl(tabId as TabId, { url: url as Url, timestamp: now() } as UrlWithTimestamp);

    // Check if this tab is already registered to a node (global)
    const existingNodeId = tabManager.nodeByTab(tabId as TabId);

    const data: NodeData = {
      url: url as Url,
      title: (tab.title || url) as Title,
      favicon: normalizeFaviconUrl(url as Url, tab.favIconUrl),
      pinned: false, // todo: check pinned.
      tags: [],
    } as NodeData;
    const metaPatch = { title: data.title, favicon: data.favicon} as NodeMetaPatch;

    // Use GLOBAL tree - shared across all windows
    const tree = await treeStorage.getOrCreateTree();
    const prevCurrentId = tree.getCurrentId();
    const snapshot = NavigationTreeMapper.toJSON(tree);
    let didMutate = false;

    if (existingNodeId !== undefined) {
      // Tab already has a node
      const node = tree.findNodeById(existingNodeId);
      if (node && node.data.url !== url) {
        // Different URL
        
          // Normal behavior: navigate from current node (creates child)
          tree.setCurrentById(existingNodeId);
          didMutate = true;
          const newNode = tree.navigate(data);
          wasNewNodeCreated = true; // New node was created
          // Re-register tab with new node (global) - this automatically unregisters from old node
          tabManager.register(newNode.id, tabId as TabId);
          // Update currentNode to new node only if tab is active
          if (!isActiveTab && prevCurrentId !== null) {
            tree.setCurrentById(prevCurrentId);
          } else {
            didUpdateCurrent = true;
          }
      } else if (node) {
        // Same URL - only update current if tab is active
        const updated = updateNodeMeta(node.data, metaPatch);
        if (updated.title !== node.data.title || updated.favicon !== node.data.favicon) {
          node.data = updated;
          didMutate = true;
        }
        if (tab.active) {
          tree.setCurrentById(existingNodeId);
          didUpdateCurrent = true;
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
        const updated = updateNodeMeta(newNode.data, metaPatch);
        if (updated.title !== newNode.data.title || updated.favicon !== newNode.data.favicon) {
          newNode.data = updated;
          didMutate = true;
        }
        // Only update currentNode if tab is active (user navigated, not programmatic)
        if (isActiveTab) {
          tree.setCurrentById(newNode.id);
          didUpdateCurrent = true;
        }
        // Register this tab with the existing node - this automatically unregisters from old node if any
        tabManager.register(newNode.id, tabId as TabId);
      } else {
        didMutate = true;
        newNode = tree.navigate(data);
        wasNewNodeCreated = true;
        tabManager.register(newNode.id, tabId as TabId);
        if (!isActiveTab && prevCurrentId !== null) {
          tree.setCurrentById(prevCurrentId);
        } else {
          didUpdateCurrent = true;
        }
      }
    

      // Check tab limit (global, skip pinned nodes)
      // await tabManager.closeOldestGlobalIfNeeded(settings.maxOpenTabs, tree); // todo: implement LRU in tab manager
    }

    if (didMutate) {
      CommandManager.saveSnapshot(snapshot, 'Navigate' as Description);
    }

    if (didMutate || didUpdateCurrent) {
      treeStorage.cacheTree(tree);
    }
    
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
