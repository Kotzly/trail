import { now, UrlWithTimestamp, type FaviconUrl, type TabId, type Title, type Url } from '../../shared/types/ids.js';
import type { TreeViewIntent } from '../../shared/types/messages.js';
import { NodeMetaPatch, updateNodeMeta, type NodeData } from '../../shared/types/node.js';
import { tabManager } from '../state/tab-manager.js';
import { treeStorage } from '../services/tree-storage.js';
import { redirectDetector } from './redirect-detection.js';
import { isNewTabContext, normalizeFaviconUrl, shouldTrackUrl } from '../utils/url-utils.js';
import { handleNewTabTab } from '../utils/new-tab.js';
import { notifyTreeUpdate } from '../messaging/notifications.js';
import { notifyUi } from '../messaging/ui-notifications.js';
import { enforceTabLimit } from '../tabs/tab-limit.js';
import { createUrlKey } from '../../shared/lib/url-key.js';

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
  if (tabManager.isIgnoredTab(tabId as TabId)) return;

  // Ensure tab still exists
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (e) {
    return; // Tab no longer exists
  }

  // Early handling for new-tab variants: always map them to the root node.
  if (isNewTabContext(url as Url, tab.title)) {
    try {
      const tree = await treeStorage.getOrCreateTree();
      const result = handleNewTabTab(tree, tab, url as Url, {
        touch: tab.active,
        setCurrent: tab.active,
      });
      if (result.handled) {
        if (result.didMutate || result.didUpdateCurrent) {
          treeStorage.cacheTree(tree);
        }
        const currentId = tree.getCurrentId();
        const view: TreeViewIntent | undefined =
          tab.active && currentId !== null ? { focusNodeId: currentId, mode: 'force' } : undefined;
        await notifyTreeUpdate(tree, 'tabs', view);
      }
    } catch (error) {
      console.debug('Navigation error:', error);
    }
    return;
  }

  // Skip ignored URLs
  if (!shouldTrackUrl(url as Url)) return;

  try {
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
      favicon: normalizeFaviconUrl(url as Url, tab.favIconUrl as FaviconUrl | undefined),
      pinned: false, // todo: check pinned.
      tags: [],
    } as NodeData;
    const metaPatch = { title: data.title, favicon: data.favicon} as NodeMetaPatch;
    const lastUsed = Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : undefined;
    const registerOptions = (touch: boolean) =>
      (lastUsed === undefined ? { touch } : { touch, lastUsed });

    // Use GLOBAL tree - shared across all windows
    const tree = await treeStorage.getOrCreateTree();
    const prevCurrentId = tree.getCurrentId();
    let didMutate = false;

    if (existingNodeId !== undefined) {
      // Tab already has a node
      const node = tree.findNodeById(existingNodeId);
      if (node && createUrlKey(node.data.url) !== createUrlKey(url as Url)) {
        // Different URL
        const nodeUrl = node.data.url as Url;
        if (!shouldTrackUrl(nodeUrl)) {
          node.data = {
            ...node.data,
            url: data.url,
            title: data.title,
            favicon: data.favicon,
          } as NodeData;
          didMutate = true;
          tabManager.register(node.id, tabId as TabId, registerOptions(isActiveTab));
          if (!isActiveTab && prevCurrentId !== null) {
            tree.setCurrentById(prevCurrentId);
          } else {
            tree.setCurrentById(node.id);
            didUpdateCurrent = true;
          }
        } else {
          // Normal behavior: navigate from current node (creates child)
          tree.setCurrentById(existingNodeId);
          didMutate = true;
          const newNode = tree.navigate(data);
          wasNewNodeCreated = true; // New node was created
          // Re-register tab with new node (global) - this automatically unregisters from old node
          tabManager.register(newNode.id, tabId as TabId, registerOptions(isActiveTab));
          // Update currentNode to new node only if tab is active
          if (!isActiveTab && prevCurrentId !== null) {
            tree.setCurrentById(prevCurrentId);
          } else {
            didUpdateCurrent = true;
          }
        }
      } else if (node) {
        // Same URL - only update current if tab is active
        const updated = updateNodeMeta(node.data, metaPatch);
        if (updated.title !== node.data.title || updated.favicon !== node.data.favicon) {
          node.data = updated;
          tree.refreshSearchEntry(node.id);
          didMutate = true;
        }
        if (tab.active) {
          tree.setCurrentById(existingNodeId);
          didUpdateCurrent = true;
        }
      }
      if (isActiveTab) {
        tabManager.touch(tabId as TabId, existingNodeId);
      }
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
          tree.refreshSearchEntry(newNode.id);
          didMutate = true;
        }
        // Only update currentNode if tab is active (user navigated, not programmatic)
        if (isActiveTab) {
          tree.setCurrentById(newNode.id);
          didUpdateCurrent = true;
        }
        // Register this tab with the existing node - this automatically unregisters from old node if any
        tabManager.register(newNode.id, tabId as TabId, registerOptions(isActiveTab));
      } else {
        didMutate = true;
        newNode = tree.navigate(data);
        wasNewNodeCreated = true;
        tabManager.register(newNode.id, tabId as TabId, registerOptions(isActiveTab));
        if (!isActiveTab && prevCurrentId !== null) {
          tree.setCurrentById(prevCurrentId);
        } else {
          didUpdateCurrent = true;
        }
      }
    

    }

    const evicted = tree.consumeEvictedCount();
    if (didMutate || didUpdateCurrent || evicted > 0) {
      treeStorage.cacheTree(tree);
    }
    if (evicted > 0) {
      notifyUi({
        message: `Evicted ${evicted} node${evicted === 1 ? '' : 's'} due to capacity`,
        icon: 'AlertTriangle',
        durationMs: 5000,
      });
    }
    await enforceTabLimit(tree, {
      activeTabId: isActiveTab ? (tabId as TabId) : null,
    });
    
    // Only notify if tab is active OR if we created a new node (not just reused existing)
    // This prevents unnecessary UI updates for programmatic tab creation
    // For inactive tabs, only notify if a new node was actually created
    if (isActiveTab || wasNewNodeCreated) {
      const reason = isActiveTab ? 'navigate' : 'sync';
      const currentId = tree.getCurrentId();
      const view: TreeViewIntent | undefined =
        isActiveTab && currentId !== null ? { focusNodeId: currentId, mode: 'force' } : undefined;
      await notifyTreeUpdate(tree, reason, view);
    }
  } catch (error) {
    console.debug('Navigation error:', error);
  }
}
