import { storageManager } from './lib/storage-manager.js';
import { tabManager } from './lib/tab-manager.js';
import * as undoManager from './lib/command-manager.js';

/**
 * Service Worker for Trail extension.
 * Handles navigation tracking, tab lifecycle, and messaging.
 * Always uses multi-tab mode with forest mode enabled.
 */

// URLs to ignore (internal browser pages, extension pages)
const IGNORED_URL_PATTERNS = [
  /^chrome:\/\//,
  /^chrome-extension:\/\//,
  /^brave:\/\//,
  /^about:/,
  /^edge:\/\//,
  /^moz-extension:\/\//,
  /^file:\/\//
];

// Map of navigations triggered from sidebar: `${tabId}:${url}` -> nodeId
const sidebarNavigations = new Map();

// Track last URL per tab for redirect detection
const lastTabUrl = new Map(); // tabId -> last URL
const REDIRECT_THRESHOLD_MS = 2000;

// Cache for settings to avoid repeated async calls
let cachedSettings = null;

/**
 * Get cached settings or fetch fresh.
 * @returns {Promise<object>}
 */
async function getSettings() {
  if (!cachedSettings) {
    cachedSettings = await storageManager.getSettings();
  }
  return cachedSettings;
}

/**
 * Check if multi-tab is enabled for a specific window.
 * Always returns true (multi-tab is always enabled).
 * @param {number} windowId
 * @returns {Promise<boolean>}
 */
async function isMultiTabForWindow(windowId) {
  return true; // Always multi-tab mode
}

/**
 * Invalidate settings cache.
 */
function invalidateSettingsCache() {
  cachedSettings = null;
}

/**
 * Check if URL should be tracked.
 * @param {string} url
 * @returns {boolean}
 */
function shouldTrackUrl(url) {
  if (!url) return false;
  return !IGNORED_URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Extract favicon URL from a page URL.
 * @param {string} url
 * @returns {string}
 */
function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.origin}/favicon.ico`;
  } catch {
    return '';
  }
}

/**
 * Handle navigation events and add to tree.
 * Always uses multi-tab mode with forest mode enabled.
 * @param {object} details - Navigation details from webNavigation API
 * @param {string} [transitionType] - Type of navigation transition
 */
async function handleNavigation(details, transitionType) {
  const { tabId, url, frameId } = details;

  // Only track main frame navigations
  if (frameId !== 0) return;

  // Skip ignored URLs
  if (!shouldTrackUrl(url)) return;

  // Get tab to determine window
  let windowId;
  try {
    const tab = await chrome.tabs.get(tabId);
    windowId = tab.windowId;
  } catch (e) {
    return; // Tab no longer exists
  }
  
  // Always use multi-tab mode
  await handleMultiTabNavigation(details, transitionType, windowId);
}

// Single-tab mode removed - always use multi-tab mode
// This function is kept for reference but should never be called
async function handleSingleTabNavigation(details, transitionType, windowId) {
  const { tabId, url } = details;

  // Skip back/forward navigation - find existing node
  if (details.transitionQualifiers?.includes('forward_back')) {
    try {
      const tree = await storageManager.getWindowTree(windowId);
      const node = tree.findByUrl(url);
      if (node) {
        tree.setCurrentById(node.id);
        await storageManager.saveWindowTree(windowId, tree);
        notifyWindowTreeUpdate(windowId, tree);
      }
    } catch (error) {
      console.debug('Back/forward navigation error:', error);
    }
    return;
  }

  // Check if this navigation was triggered by clicking in sidebar
  const navKey = `${windowId}:${url}`;
  if (sidebarNavigations.has(navKey)) {
    const nodeId = sidebarNavigations.get(navKey);
    sidebarNavigations.delete(navKey);
    try {
      const tree = await storageManager.getWindowTree(windowId);
      tree.setCurrentById(nodeId);
      await storageManager.saveWindowTree(windowId, tree);
      notifyWindowTreeUpdate(windowId, tree);
    } catch (error) {
      console.debug('Sidebar navigation update error:', error);
    }
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    const settings = await getSettings();
    
    lastTabUrl.set(tabId, url);

    const entry = {
      url,
      title: tab.title || url,
      favicon: tab.favIconUrl || getFaviconUrl(url),
      timestamp: Date.now()
    };

    const tree = await storageManager.getWindowTree(windowId);
    tree.navigate(entry, { backOnRevisit: true });
    await storageManager.saveWindowTree(windowId, tree);

    notifyWindowTreeUpdate(windowId, tree);
  } catch (error) {
    console.debug('Navigation handling error:', error);
  }
}


// Track recent tab registrations for redirect detection (tabId -> timestamp)
const recentTabRegistrations = new Map();

/**
 * Find the window that owns a node by finding its root and the window of tabs in that root.
 * @param {number} nodeId - Node ID to find window for
 * @param {NavigationTree} tree - Global tree
 * @returns {Promise<number>} - Window ID, or current window if not found
 */
async function findWindowForNode(nodeId, tree) {
  try {
    // Find the root that contains this node
    const root = tree.findRootForNode(nodeId);
    if (!root) {
      // Fallback: return current window
      const windows = await chrome.windows.getAll();
      return windows.find(w => w.focused)?.id || windows[0]?.id;
    }
    
    // Find all nodes in this root tree (recursively)
    const nodesInRoot = [];
    function collectNodes(node) {
      if (!node) return;
      nodesInRoot.push(node.id);
      if (node.children) {
        node.children.forEach(collectNodes);
      }
    }
    collectNodes(root);
    
    // Find tabs for nodes in this root
    const windowIds = new Set();
    for (const nid of nodesInRoot) {
      const tabInfo = tabManager.getTabForNodeGlobal(nid);
      if (tabInfo) {
        windowIds.add(tabInfo.windowId);
      }
    }
    
    // If we found windows, return the first one (or most common one)
    if (windowIds.size > 0) {
      // Return the first window, or try to find the one with most tabs from this root
      const windowTabCounts = new Map();
      for (const wid of windowIds) {
        let count = 0;
        for (const nid of nodesInRoot) {
          const tabInfo = tabManager.getTabForNodeGlobal(nid);
          if (tabInfo && tabInfo.windowId === wid) {
            count++;
          }
        }
        windowTabCounts.set(wid, count);
      }
      
      // Return window with most tabs from this root
      let maxCount = 0;
      let bestWindowId = null;
      for (const [wid, count] of windowTabCounts) {
        if (count > maxCount) {
          maxCount = count;
          bestWindowId = wid;
        }
      }
      
      const candidateWindowId = bestWindowId || Array.from(windowIds)[0];
      
      // Verify that the window still exists (not closed)
      try {
        await chrome.windows.get(candidateWindowId);
        return candidateWindowId;
      } catch (e) {
        // Window was closed - return null to indicate new window should be created
        return null;
      }
    }
    
    // No open tabs found for this root - this is an orphan branch (window was closed)
    // Return null to indicate new window should be created
    return null;
  } catch (e) {
    // Error occurred - return null to indicate new window should be created
    return null;
  }
}

// Track windows created for existing nodes (orphan branches) - windowId -> nodeId
// This prevents windows.onCreated from creating a new root for these windows
const pendingNodeForWindow = new Map();

// Track pending window creation for orphan nodes - use a temporary flag before window is created
// We'll use this to handle race condition where windows.onCreated fires before we set pendingNodeForWindow
let pendingOrphanWindowCreation = null;

// Track tabs created programmatically (e.g., "open in new tab") - don't auto-switch focus to them
const programmaticTabs = new Set(); // tabId -> true

/**
 * Handle navigation in multi-tab mode.
 * Uses GLOBAL tree - all windows share the same graph.
 * Each node maps to exactly one tab in one window.
 */
async function handleMultiTabNavigation(details, transitionType, windowId) {
  const { tabId, url } = details;

  // Skip blank/undefined URLs - just track for redirect detection, don't create nodes
  if (!url || url === 'about:blank') {
    lastTabUrl.set(tabId, url || 'about:blank');
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    const settings = await getSettings();
    
    // CRITICAL: Only update currentNode if this tab is active (user navigated)
    // If tab is not active, it was created programmatically - don't switch focus
    const isActiveTab = tab.active;
    
    // Track whether we create a new node (vs reusing existing)
    let wasNewNodeCreated = false;

    // Track URL for about:blank redirect detection
    const prevUrl = lastTabUrl.get(tabId);
    lastTabUrl.set(tabId, url);

    // Check if this tab is already registered to a node (global)
    const existingNodeId = tabManager.getNodeForTabGlobal(tabId);

    const entry = {
      url,
      title: tab.title || url,
      favicon: tab.favIconUrl || getFaviconUrl(url),
      timestamp: Date.now()
    };

    // Use GLOBAL tree - shared across all windows
    const tree = await storageManager.getGlobalTree();

    // --- Redirect detection (from blank/undefined URLs) ---
    const isFromBlankUrl = !prevUrl || prevUrl === 'about:blank';

    if (existingNodeId !== null) {
      // Tab already has a node
      const node = tree.findNodeById(existingNodeId);
      if (node && node.url !== url) {
        // Different URL
        
        // Check if this is a pinned tab in sync mode - update in place instead of creating child
        if (settings.pinSyncBrowser && node.pinned) {
          // Pinned tab: update the node in place (acts as a "slot")
          node.url = url;
          node.title = entry.title;
          node.favicon = entry.favicon;
          node.timestamp = entry.timestamp;
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
          tabManager.registerGlobal(newNode.id, windowId, tabId);
          // Update currentNode to new node only if tab is active
          if (tab.active) {
            tree.setCurrentById(newNode.id);
          }
          // Update tab counts immediately after re-registration (even if tab is inactive)
          // This ensures "New Tab" counter decreases immediately when tab navigates away
          await storageManager.saveGlobalTree(tree);
          notifyGlobalTreeUpdate(tree, windowId);
        }
      } else if (node) {
        // Same URL - only update current if tab is active
        if (tab.active) {
          tree.setCurrentById(existingNodeId);
        }
      }
      tabManager.touchGlobal(tabId);
    } else {
      // New tab without existing node
      let newNode;

      // First, try to find existing node with this URL in the current window's tree
      let existingNodeInWindow = null;
      try {
        // Get all tabs in current window
        const windowTabs = await chrome.tabs.query({ windowId });
        // Find nodes for tabs in this window
        const windowNodeIds = new Set();
        for (const wt of windowTabs) {
          const nodeId = tabManager.getNodeForTabGlobal(wt.id);
          if (nodeId !== null) {
            windowNodeIds.add(nodeId);
          }
        }
        
        // Find the root for this window (use first node's root, or search all roots)
        let windowRoot = null;
        if (windowNodeIds.size > 0) {
          // Find root for any node in this window
          for (const nodeId of windowNodeIds) {
            windowRoot = tree.findRootForNode(nodeId);
            if (windowRoot) break;
          }
        }
        
        // If we found a root for this window, search URL in that root first
        if (windowRoot) {
          existingNodeInWindow = tree.findByUrlInRoot(windowRoot, url);
        }
        
        // If not found in window root, search in all roots (fallback)
        if (!existingNodeInWindow) {
          existingNodeInWindow = tree.findByUrl(url);
        }
      } catch (e) {
        // Fallback to global search
        existingNodeInWindow = tree.findByUrl(url);
      }

      // If found existing node, use it instead of creating new
      if (existingNodeInWindow) {
        newNode = existingNodeInWindow;
        // Only update currentNode if tab is active (user navigated, not programmatic)
        if (isActiveTab) {
          tree.setCurrentById(newNode.id);
        }
        // Register this tab with the existing node - this automatically unregisters from old node if any
        tabManager.registerGlobal(newNode.id, windowId, tabId);
        recentTabRegistrations.set(tabId, Date.now());
        // Update tab counts immediately after registration (even if tab is inactive)
        // This ensures "New Tab" counter decreases immediately when tab navigates to existing node
        await storageManager.saveGlobalTree(tree);
        notifyGlobalTreeUpdate(tree, windowId);
      } else {
        // Check if this is a redirect
        const lastRegistration = recentTabRegistrations.get(tabId);
        const isRedirect = (lastRegistration && (Date.now() - lastRegistration < REDIRECT_THRESHOLD_MS)) || isFromBlankUrl;

        // Always forest mode: each new tab creates its own tree root (unless redirect)
        if (!isRedirect) {
          // Forest mode: each new tab creates its own tree root
          newNode = tree.createNewRoot(entry);
        } else {
          // Redirect: branch from current node (backOnRevisit always enabled)
          newNode = tree.navigate(entry, { backOnRevisit: true });
        }
        
        wasNewNodeCreated = true; // New node was created

        // Register globally (nodeId -> {windowId, tabId}) - this automatically unregisters from old node if any
        tabManager.registerGlobal(newNode.id, windowId, tabId);
        recentTabRegistrations.set(tabId, Date.now());
        
        // Only update currentNode if tab is active (user navigated, not programmatic)
        if (isActiveTab) {
          tree.setCurrentById(newNode.id);
        }
        // Update tab counts immediately after registration (even if tab is inactive)
        // This ensures "New Tab" counter decreases immediately when tab navigates to new node
        await storageManager.saveGlobalTree(tree);
        notifyGlobalTreeUpdate(tree, windowId);
      }
      
      // Sync browser tab pin state to node (only in pinSyncBrowser mode)
      if (settings.enablePinNodes && settings.pinSyncBrowser) {
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
      if (recentTabRegistrations.size > 100) {
        const now = Date.now();
        for (const [tid, time] of recentTabRegistrations) {
          if (now - time > REDIRECT_THRESHOLD_MS * 2) {
            recentTabRegistrations.delete(tid);
          }
        }
      }

      // Check tab limit (global, skip pinned nodes)
      await tabManager.closeOldestGlobalIfNeeded(settings.multiTabLimit, tree);
    }

    await storageManager.saveGlobalTree(tree);
    
    // Only notify if tab is active OR if we created a new node (not just reused existing)
    // This prevents unnecessary UI updates for programmatic tab creation
    // For inactive tabs, only notify if a new node was actually created
    if (isActiveTab || wasNewNodeCreated) {
      notifyGlobalTreeUpdate(tree);
    }
  } catch (error) {
    console.debug('Multi-tab navigation error:', error);
  }
}

/**
 * Notify side panel that a tree has been updated (single-tab mode).
 * @param {number} tabId
 */
async function notifyTreeUpdate(tabId) {
  try {
    const tree = await storageManager.getTree(tabId);
    chrome.runtime.sendMessage({
      type: 'TREE_UPDATED',
      tabId,
      tree: tree.toJSON()
    }).catch(() => {
      // Side panel might not be open, ignore
    });
  } catch (error) {
    console.debug('Notify error:', error);
  }
}

/**
 * Get tab states (muted, audible) for all open tabs in the global tree.
 * @returns {Promise<Object>} Map of nodeId -> { muted, audible }
 */
async function getTabStates() {
  const tabStates = {};
  const openNodes = tabManager.getAllOpenNodes();
  
  for (const nodeId of openNodes) {
    const tabInfo = tabManager.getTabForNodeGlobal(nodeId);
    if (tabInfo) {
      try {
        const tab = await chrome.tabs.get(tabInfo.tabId);
        tabStates[nodeId] = {
          muted: tab.mutedInfo?.muted || false,
          audible: tab.audible || false
        };
      } catch (e) {
        // Tab might have been closed
        tabStates[nodeId] = { muted: false, audible: false };
      }
    }
  }
  
  return tabStates;
}

/**
 * Notify ALL side panels that the global tree has been updated.
 * Broadcasts to all windows so they all show the same graph.
 * @param {NavigationTree} tree
 */
async function notifyGlobalTreeUpdate(tree, windowId = null) {
  try {
    const openNodeIds = Array.from(tabManager.getAllOpenNodes());
    const tabStates = await getTabStates();
    
    // Get tab counts per node per window for badge display
    const nodeTabCounts = {};
    if (windowId !== null) {
      // Only calculate for specific window if provided
      const openNodes = tabManager.getAllOpenNodes();
      for (const nodeId of openNodes) {
        const count = tabManager.getTabCountForNodeInWindow(nodeId, windowId);
        if (count > 1) {
          nodeTabCounts[nodeId] = count;
        }
      }
    } else {
      // Calculate for all windows (get all window IDs)
      try {
        const windows = await chrome.windows.getAll();
        const openNodes = tabManager.getAllOpenNodes();
        for (const nodeId of openNodes) {
          let maxCount = 0;
          for (const win of windows) {
            const count = tabManager.getTabCountForNodeInWindow(nodeId, win.id);
            if (count > maxCount) maxCount = count;
          }
          if (maxCount > 1) {
            nodeTabCounts[nodeId] = maxCount;
          }
        }
      } catch (e) {
        // Fallback: calculate for current window only
        const openNodes = tabManager.getAllOpenNodes();
        for (const nodeId of openNodes) {
          const primaryTab = tabManager.getTabForNodeGlobal(nodeId);
          if (primaryTab) {
            const count = tabManager.getTabCountForNodeInWindow(nodeId, primaryTab.windowId);
            if (count > 1) {
              nodeTabCounts[nodeId] = count;
            }
          }
        }
      }
    }
    
    chrome.runtime.sendMessage({
      type: 'GLOBAL_TREE_UPDATED',
      tree: tree.toJSON(),
      openNodeIds,
      tabStates,
      nodeTabCounts // Add tab counts for badge display
    }).catch(() => {
      // Side panel might not be open, ignore
    });
  } catch (error) {
    console.debug('Notify global error:', error);
  }
}

/**
 * Notify side panel that a window tree has been updated (multi-tab mode).
 * @param {number} windowId
 * @param {NavigationTree} tree
 */
async function notifyWindowTreeUpdate(windowId, tree) {
  try {
    const openNodeIds = Array.from(tabManager.getOpenNodesForWindow(windowId));
    chrome.runtime.sendMessage({
      type: 'WINDOW_TREE_UPDATED',
      windowId,
      tree: tree.toJSON(),
      openNodeIds
    }).catch(() => {
      // Side panel might not be open, ignore
    });
  } catch (error) {
    console.debug('Notify window error:', error);
  }
}

// Prefetch hints removed for simplicity

// ============================================
// Event Listeners
// ============================================

/**
 * Track page navigations (link clicks, form submissions, etc.)
 */
chrome.webNavigation.onCommitted.addListener(async (details) => {
  const { transitionType } = details;
  
  // Track link clicks, typed URLs, form submissions, and reloads
  const trackableTransitions = ['link', 'typed', 'form_submit', 'generated', 'auto_bookmark'];
  
  if (trackableTransitions.includes(transitionType)) {
    handleNavigation(details, transitionType);
  }
});

/**
 * Track SPA navigations (History API pushState/replaceState).
 */
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  handleNavigation(details, 'spa_navigation');
});

/**
 * Update entry title when page finishes loading.
 */
chrome.webNavigation.onCompleted.addListener(async (details) => {
  const { tabId, frameId, url } = details;
  
  if (frameId !== 0) return;
  if (!shouldTrackUrl(url)) return;

  try {
    const tab = await chrome.tabs.get(tabId);
    const settings = await getSettings();
    
    // Always multi-tab mode: use global tree
    const nodeId = tabManager.getNodeForTabGlobal(tabId);
    if (nodeId !== null) {
      const tree = await storageManager.getGlobalTree();
      const node = tree.findNodeById(nodeId);
      // CRITICAL: Only update if URL matches to prevent race conditions
      if (node && node.url === url && tab.title && tab.title !== node.title) {
        node.title = tab.title;
        node.favicon = tab.favIconUrl || node.favicon;
        await storageManager.saveGlobalTree(tree);
        notifyGlobalTreeUpdate(tree);
      }
    }
  } catch (error) {
    console.debug('onCompleted error:', error);
  }
});

/**
 * Cleanup tree when tab is closed.
 */
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  // Clean up programmatic tab flag
  programmaticTabs.delete(tabId);
  chrome.storage.session.remove(`programmaticTab_${tabId}`);
  
  // Always multi-tab mode: unregister tab globally
  tabManager.unregisterGlobal(tabId);
  
  // Update currentNode to active tab in the same window (if window still exists)
  try {
    const tree = await storageManager.getGlobalTree();
    const windowId = removeInfo.windowId;
    
    // Try to find active tab in the same window
    try {
      const activeTabs = await chrome.tabs.query({ windowId, active: true });
      if (activeTabs.length > 0) {
        const activeTab = activeTabs[0];
        const activeNodeId = tabManager.getNodeForTabGlobal(activeTab.id);
        if (activeNodeId !== null) {
          // Update currentNode to the active tab
          tree.setCurrentById(activeNodeId);
          await storageManager.saveGlobalTree(tree);
        }
      }
    } catch (e) {
      // Window might be closed, ignore
    }
    
    // Notify all sidepanels to update closed state
    notifyGlobalTreeUpdate(tree);
  } catch (e) {
    console.debug('Error updating currentNode on tab removal:', e);
  }
});

/**
 * Track tab audio state changes (muted, audible).
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only care about muted/audible changes
  if (!('mutedInfo' in changeInfo) && !('audible' in changeInfo)) return;
  
  const settings = await getSettings();
  // Always multi-tab mode - check if this tab is in our global tracking
  const nodeId = tabManager.getNodeForTabGlobal(tabId);
  if (nodeId === null) return;
  
  // Notify sidepanels to update tab states
  try {
    const tree = await storageManager.getGlobalTree();
    notifyGlobalTreeUpdate(tree);
  } catch (e) {}
});

/**
 * Track tab title and favicon changes.
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only care about title or favicon changes
  if (!changeInfo.title && !changeInfo.favIconUrl) return;
  
  // Check if this tab is in our global tracking
  const nodeId = tabManager.getNodeForTabGlobal(tabId);
  if (nodeId === null) return;
  
  // Get current tab URL to verify it matches the node
  const currentUrl = tab.url || tab.pendingUrl;
  if (!currentUrl) return;
  
  // Update the node's title/favicon in the tree
  try {
    const tree = await storageManager.getGlobalTree();
    const node = tree.findNodeById(nodeId);
    
    // CRITICAL: Only update if the node's URL matches the current tab URL
    // This prevents updating wrong nodes due to race conditions
    if (node && node.url === currentUrl) {
      let updated = false;
      
      if (changeInfo.title && changeInfo.title !== node.title) {
        node.title = changeInfo.title;
        updated = true;
      }
      
      if (changeInfo.favIconUrl && changeInfo.favIconUrl !== node.favicon) {
        node.favicon = changeInfo.favIconUrl;
        updated = true;
      }
      
      if (updated) {
        await storageManager.saveGlobalTree(tree);
        notifyGlobalTreeUpdate(tree);
      }
    }
  } catch (e) {
    console.error('Error updating node title/favicon:', e);
  }
});

/**
 * Sync browser tab pin state to extension node pin state.
 * Only active when pinSyncBrowser is enabled (Mode A).
 * When user pins/unpins a tab in browser, update the node.
 * In sync mode, pinned nodes update in place (no children created), so only pin the node itself.
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only care about pinned state changes
  if (!('pinned' in changeInfo)) return;
  
  const settings = await getSettings();
  // Only sync when pinSyncBrowser is enabled (Mode A)
  if (!settings.enablePinNodes || !settings.pinSyncBrowser) return;
  
  // Always multi-tab mode - check if this tab is in our global tracking
  const nodeId = tabManager.getNodeForTabGlobal(tabId);
  if (nodeId === null) return;
  
  // Update the node's pinned state
  try {
    const tree = await storageManager.getGlobalTree();
    const node = tree.findNodeById(nodeId);
    if (node && node.pinned !== changeInfo.pinned) {
      node.pinned = changeInfo.pinned;
      
      await storageManager.saveGlobalTree(tree);
      notifyGlobalTreeUpdate(tree);
    }
  } catch (e) {
    console.error('Error syncing pin state:', e);
  }
});

/**
 * Cleanup when window is closed.
 * For global mode: unregister tabs from that window but keep tree.
 */
chrome.windows.onRemoved.addListener(async (windowId) => {
  const settings = await getSettings();
  
  if (settings.multiTabEnabled) {
    // Unregister tabs from this window (legacy per-window mappings)
    tabManager.unregisterWindow(windowId);
    
    // In global mode, we don't remove the tree - it's shared.
    // Tabs in this window will be unregistered via tabs.onRemoved.
    // Only clean up legacy per-window tree if it exists.
    await storageManager.removeWindowTree(windowId);
  }
});

/**
 * Handle new window creation - create new root in global tree.
 * Skip if window was created for an existing node (orphan branch).
 */
chrome.windows.onCreated.addListener(async (window) => {
  try {
    // Always multi-tab mode - create new root for new window
    // Get the first tab in the new window
    const tabs = await chrome.tabs.query({ windowId: window.id });
    if (tabs.length === 0) return;
    
    const tab = tabs[0];
    const tabUrl = tab.pendingUrl || tab.url || '';
    
    // Check if this window was created for an existing node (orphan branch)
    // First check the Map (set after window creation)
    let existingNodeId = pendingNodeForWindow.get(window.id);
    
    // Also check if there's a pending orphan window creation
    if (existingNodeId === undefined && pendingOrphanWindowCreation !== null) {
      // Small delay to allow NAVIGATE_TO handler to set pendingNodeForWindow
      await new Promise(resolve => setTimeout(resolve, 50));
      existingNodeId = pendingNodeForWindow.get(window.id);
    }
    
    // Also check by URL - if there's a node with this URL that has no open tab, it's an orphan branch
    if (existingNodeId === undefined && tabUrl) {
      try {
        const tree = await storageManager.getGlobalTree();
        const nodeByUrl = tree.findByUrl(tabUrl);
        if (nodeByUrl) {
          // Check if this node has no open tab (orphan branch)
          const tabInfo = tabManager.getTabForNodeGlobal(nodeByUrl.id);
          if (tabInfo === null) {
            // This is an orphan branch - don't create new root
            existingNodeId = nodeByUrl.id;
            // Register the tab with this node
            tabManager.registerGlobal(nodeByUrl.id, window.id, tab.id);
            pendingNodeForWindow.set(window.id, nodeByUrl.id);
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    if (existingNodeId !== undefined) {
      // This window was created for an existing node - don't create new root
      pendingNodeForWindow.delete(window.id);
      pendingOrphanWindowCreation = null;
      
      // The node is already registered
      // Just update the tree's current node
      const tree = await storageManager.getGlobalTree();
      tree.setCurrentById(existingNodeId);
      await storageManager.saveGlobalTree(tree);
      notifyGlobalTreeUpdate(tree);
      return;
    }
    
    // Clear pending flag if this was a regular window creation
    pendingOrphanWindowCreation = null;
    
    // This is a new window - create new root
    const tree = await storageManager.getGlobalTree();
    const settings = await getSettings();
    
    // Create a new root node for this window/tab
    const newNode = tree.createNewRoot({
      url: tabUrl,
      title: tab.title || '',
      favicon: tab.favIconUrl || ''
    });
    
    await storageManager.saveGlobalTree(tree);
    
    if (settings.multiTabEnabled) {
      tabManager.registerGlobal(newNode.id, tab.windowId, tab.id);
    }
    
    notifyGlobalTreeUpdate(tree);
  } catch (error) {
    console.debug('Error creating root for new window:', error);
  }
});

/**
 * Handle tab replacement (e.g., prerendering).
 */
chrome.webNavigation.onTabReplaced.addListener(async (details) => {
  const { replacedTabId, tabId } = details;
  
  // Move tree from old tab to new tab
  try {
    const oldTree = await storageManager.getTree(replacedTabId);
    await storageManager.saveTree(tabId, oldTree);
    await storageManager.removeTree(replacedTabId);
  } catch (error) {
    console.debug('Tab replacement error:', error);
  }
});

/**
 * Handle messages from side panel and options page.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'URL_CHANGED': {
          // Handle URL change from content script (hash changes, pushState, etc.)
          const tabId = sender.tab?.id;
          if (!tabId) break;
          
          const url = message.url;
          if (!shouldTrackUrl(url)) break;
          
          // Check if this is a sidebar navigation (user clicked in sidebar)
          const navKey = `${tabId}:${url}`;
          if (sidebarNavigations.has(navKey)) {
            const nodeId = sidebarNavigations.get(navKey);
            sidebarNavigations.delete(navKey);
            const tree = await storageManager.getTree(tabId);
            tree.setCurrentById(nodeId);
            await storageManager.saveTree(tabId, tree);
            notifyTreeUpdate(tabId);
            break;
          }
          
          // Back/forward navigation - find existing node
          if (message.isBackForward) {
            const tree = await storageManager.getTree(tabId);
            const node = tree.findByUrl(url);
            if (node) {
              tree.setCurrentById(node.id);
              await storageManager.saveTree(tabId, tree);
              notifyTreeUpdate(tabId);
            }
            break;
          }
          
          // New navigation - add to tree
          const settings = await getSettings();
          const entry = {
            url,
            title: message.title || url,
            favicon: sender.tab.favIconUrl || getFaviconUrl(url),
            timestamp: Date.now()
          };

          const tree = await storageManager.getTree(tabId);
          tree.navigate(entry, { backOnRevisit: true });
          await storageManager.saveTree(tabId, tree);
          notifyTreeUpdate(tabId);
          break;
        }
        
        case 'TITLE_CHANGED': {
          // Handle title change from content script (YouTube, SPA pages, etc.)
          const tabId = sender.tab?.id;
          if (!tabId) break;
          
          const url = message.url;
          const newTitle = message.title;
          if (!newTitle || !shouldTrackUrl(url)) break;
          
          const settings = await getSettings();
          
          try {
            if (settings.multiTabEnabled) {
              // Multi-tab mode - use GLOBAL tree
              const nodeId = tabManager.getNodeForTabGlobal(tabId);
              if (nodeId !== null) {
                const tree = await storageManager.getGlobalTree();
                const node = tree.findNodeById(nodeId);
                if (node && node.url === url && node.title !== newTitle) {
                  node.title = newTitle;
                  await storageManager.saveGlobalTree(tree);
                  notifyGlobalTreeUpdate(tree);
                }
              }
            }
          } catch (error) {
            console.debug('Title update error:', error);
          }
          break;
        }
        
        case 'GET_TREE': {
          // Always multi-tab mode: use global tree (shared across all windows)
          const tab = await chrome.tabs.get(message.tabId);
          const tree = await storageManager.getGlobalTree();
          
          // Try to find node for active tab (global lookup)
          let activeNodeId = tabManager.getNodeForTabGlobal(tab.id);
          
          // If tab not registered, try to find node by URL (first in current window's tree, then globally)
          if (activeNodeId === null && tab.url) {
              let nodeByUrl = null;
              
              // First, try to find in current window's root
              try {
                const windowTabs = await chrome.tabs.query({ windowId: tab.windowId });
                const windowNodeIds = new Set();
                for (const wt of windowTabs) {
                  const nid = tabManager.getNodeForTabGlobal(wt.id);
                  if (nid !== null) {
                    windowNodeIds.add(nid);
                  }
                }
                
                let windowRoot = null;
                if (windowNodeIds.size > 0) {
                  for (const nid of windowNodeIds) {
                    windowRoot = tree.findRootForNode(nid);
                    if (windowRoot) break;
                  }
                }
                
                if (windowRoot) {
                  nodeByUrl = tree.findByUrlInRoot(windowRoot, tab.url);
                }
              } catch (e) {
                // Fall through to global search
              }
              
              // If not found in window root, search globally
              if (!nodeByUrl) {
                nodeByUrl = tree.findByUrl(tab.url);
              }
              
              // CRITICAL: Only use node if URL matches exactly
              if (nodeByUrl && nodeByUrl.url === tab.url) {
                activeNodeId = nodeByUrl.id;
                tabManager.registerGlobal(nodeByUrl.id, tab.windowId, tab.id);
                
                // Update currentNode
                tree.setCurrentById(activeNodeId);
                await storageManager.saveGlobalTree(tree);
              }
            }
            
            // Update currentNode if we found the node and URL matches
            if (activeNodeId !== null) {
              const node = tree.findNodeById(activeNodeId);
              if (node && node.url === tab.url && tree.getCurrentId() !== activeNodeId) {
                tree.setCurrentById(activeNodeId);
                await storageManager.saveGlobalTree(tree);
              }
            }
            
            const openNodeIds = Array.from(tabManager.getAllOpenNodes());
            const tabStates = await getTabStates();
            
            // Calculate tab counts for current window
            const nodeTabCounts = {};
            for (const nodeId of openNodeIds) {
              const count = tabManager.getTabCountForNodeInWindow(nodeId, tab.windowId);
              if (count > 1) {
                nodeTabCounts[nodeId] = count;
              }
            }
            
          sendResponse({ 
            success: true, 
            tree: tree.toJSON(),
            openNodeIds,
            tabStates,
            nodeTabCounts,
            multiTabMode: true,
            windowId: tab.windowId
          });
          break;
        }
        
        case 'GET_WINDOW_TREE': {
          // Returns GLOBAL tree (shared across all windows)
          const tree = await storageManager.getGlobalTree();
          const openNodeIds = Array.from(tabManager.getAllOpenNodes());
          const tabStates = await getTabStates();
          sendResponse({ 
            success: true, 
            tree: tree.toJSON(),
            openNodeIds,
            tabStates
          });
          break;
        }
        
        case 'GET_CURRENT_TAB': {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          sendResponse({ success: true, tab });
          break;
        }
        
        case 'IS_MULTI_TAB_MODE': {
          // Always multi-tab mode
          sendResponse({ success: true, enabled: true });
          break;
        }
        
        case 'NAVIGATE_TO': {
          const { windowId, nodeId, url, tabId } = message;
          const settings = await getSettings();
          
          // Always multi-tab mode with GLOBAL tree: node may be in ANY window
          const tree = await storageManager.getGlobalTree();
            
            // Check if there are multiple tabs for this node in the current window
            const tabsInWindow = tabManager.getTabsForNodeInWindow(nodeId, windowId);
            
            if (tabsInWindow.length > 1) {
              // Multiple tabs exist - cycle to next tab
              const nextTab = tabManager.getNextTabForNodeInWindow(nodeId, windowId, tabId);
              if (nextTab) {
                try {
                  await chrome.windows.update(nextTab.windowId, { focused: true });
                  await chrome.tabs.update(nextTab.tabId, { active: true });
                  tabManager.touchGlobal(nextTab.tabId);
                  // Update currentNode to the focused tab's node
                  tree.setCurrentById(nodeId);
                  await storageManager.saveGlobalTree(tree);
                  notifyGlobalTreeUpdate(tree);
                  sendResponse({ success: true });
                  break;
                } catch (e) {
                  // Tab might have been closed - fall through to single tab logic
                }
              }
            }
            
            // Single tab or cycling failed - use existing logic
            const existing = tabManager.getTabForNodeGlobal(nodeId);

            if (existing !== null) {
              // Tab exists - focus its window and activate it
              try {
                await chrome.windows.update(existing.windowId, { focused: true });
                await chrome.tabs.update(existing.tabId, { active: true });
                tabManager.touchGlobal(existing.tabId);
              } catch (e) {
                // Tab might have been closed externally
                tabManager.unregisterGlobal(existing.tabId);
                // Create new tab in the window that owns this node, or new window if orphan
                const targetWindowId = await findWindowForNode(nodeId, tree);
                if (targetWindowId) {
                  // Window exists - focus it and create tab there
                  await chrome.windows.update(targetWindowId, { focused: true });
                  const newTab = await chrome.tabs.create({ windowId: targetWindowId, url, active: true });
                  tabManager.registerGlobal(nodeId, targetWindowId, newTab.id);
                } else {
                  // Orphan branch - create new window for existing node
                  // Set flag BEFORE creating window to handle race condition
                  pendingOrphanWindowCreation = nodeId;
                  const newWindow = await chrome.windows.create({ focused: true, url });
                  // Set in Map after window is created (for windows.onCreated that might run later)
                  pendingNodeForWindow.set(newWindow.id, nodeId);
                  const tabs = await chrome.tabs.query({ windowId: newWindow.id });
                  const newTab = tabs[0];
                  tabManager.registerGlobal(nodeId, newWindow.id, newTab.id);
                }
              }
            } else {
              // No tab for this node - find the window that owns this node's tree
              const targetWindowId = await findWindowForNode(nodeId, tree);
              if (targetWindowId) {
                // Window exists - focus it and create tab there
                await chrome.windows.update(targetWindowId, { focused: true });
                const newTab = await chrome.tabs.create({ windowId: targetWindowId, url, active: true });
                tabManager.registerGlobal(nodeId, targetWindowId, newTab.id);
                // Update tab counts immediately after registration
                await storageManager.saveGlobalTree(tree);
                notifyGlobalTreeUpdate(tree, targetWindowId);
              } else {
                // Orphan branch - create new window for existing node
                // Set flag BEFORE creating window to handle race condition
                pendingOrphanWindowCreation = nodeId;
                const newWindow = await chrome.windows.create({ focused: true, url });
                // Set in Map after window is created (for windows.onCreated that might run later)
                pendingNodeForWindow.set(newWindow.id, nodeId);
                const tabs = await chrome.tabs.query({ windowId: newWindow.id });
                const newTab = tabs[0];
                tabManager.registerGlobal(nodeId, newWindow.id, newTab.id);
              }
              
              // Check limit (global, skip pinned nodes)
              await tabManager.closeOldestGlobalIfNeeded(settings.multiTabLimit, tree);
            }
            
            // Update current node in GLOBAL tree
            tree.setCurrentById(nodeId);
            await storageManager.saveGlobalTree(tree);
            notifyGlobalTreeUpdate(tree);
            
            sendResponse({ success: true });
          break;
        }
        
        case 'OPEN_IN_CURRENT_TAB': {
          // Open URL in the current active tab
          const { url } = message;
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab) {
            await chrome.tabs.update(activeTab.id, { url });
          }
          sendResponse({ success: true });
          break;
        }
        
        case 'OPEN_IN_NEW_TAB': {
          // Open node URL in a new tab (background, don't switch focus)
          const { nodeId } = message;
          const tree = await storageManager.getGlobalTree();
          const node = tree.findById(nodeId);
          if (node) {
            // Mark as programmatic BEFORE creating tab to prevent auto-focus
            // Use a promise-based approach to ensure flag is set before tab creation
            const flagKey = `programmaticTab_pending_${Date.now()}_${Math.random()}`;
            await chrome.storage.session.set({ [flagKey]: true });
            
            const tab = await chrome.tabs.create({ url: node.url, active: false });
            
            // Immediately mark actual tab as programmatic (before any events fire)
            programmaticTabs.add(tab.id);
            const actualFlagKey = `programmaticTab_${tab.id}`;
            await chrome.storage.session.set({ [actualFlagKey]: true });
            await chrome.storage.session.remove(flagKey);
            
            const settings = await getSettings();
            if (settings.multiTabEnabled) {
              tabManager.registerGlobal(nodeId, tab.windowId, tab.id);
              // DO NOT update currentNode - keep focus on current tab
              // But DO notify to update tab count badge immediately
              await storageManager.saveGlobalTree(tree);
              notifyGlobalTreeUpdate(tree, tab.windowId);
            }
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Node not found' });
          }
          break;
        }
        
        case 'CREATE_NEW_ROOT': {
          // Create a new window - the windows.onCreated listener will handle creating the root
          try {
            const window = await chrome.windows.create({ focused: true });
            sendResponse({ success: true, windowId: window.id });
          } catch (e) {
            sendResponse({ success: false, error: e.message });
          }
          break;
        }
        
        case 'TOGGLE_MUTE': {
          // Toggle mute state for a tab by nodeId
          const { nodeId } = message;
          const tabInfo = tabManager.getTabForNodeGlobal(nodeId);
          if (tabInfo) {
            try {
              const tab = await chrome.tabs.get(tabInfo.tabId);
              const newMuted = !tab.mutedInfo?.muted;
              await chrome.tabs.update(tabInfo.tabId, { muted: newMuted });
              sendResponse({ success: true, muted: newMuted });
            } catch (e) {
              sendResponse({ success: false, error: e.message });
            }
          } else {
            sendResponse({ success: false, error: 'Tab not found' });
          }
          break;
        }
        
        case 'CLOSE_TAB': {
          // Close tab for a node
          const { nodeId } = message;
          const tabInfo = tabManager.getTabForNodeGlobal(nodeId);
          if (tabInfo) {
            try {
              await chrome.tabs.remove(tabInfo.tabId);
              sendResponse({ success: true });
            } catch (e) {
              sendResponse({ success: false, error: e.message });
            }
          } else {
            sendResponse({ success: false, error: 'Tab not found' });
          }
          break;
        }
        
        case 'TOGGLE_PIN': {
          // Toggle pinned state for a node
          const { nodeId } = message;
          const tree = await storageManager.getGlobalTree();
          const settings = await getSettings();
          
          // Always toggle just this node (in sync mode, pinned nodes update in place anyway)
          const newPinned = tree.togglePinned(nodeId);
          
          if (newPinned !== null) {
            // Mode A: also sync with browser tab pin
            if (settings.pinSyncBrowser) {
              const tabInfo = tabManager.getTabForNodeGlobal(nodeId);
              if (tabInfo) {
                try {
                  await chrome.tabs.update(tabInfo.tabId, { pinned: newPinned });
                } catch (e) {
                  // Tab might be closed
                }
              }
            }
            
            await storageManager.saveGlobalTree(tree);
            notifyGlobalTreeUpdate(tree);
            sendResponse({ success: true, pinned: newPinned });
          } else {
            sendResponse({ success: false, error: 'Node not found' });
          }
          break;
        }
        
        case 'SET_TAGS': {
          // Set all tags for a node
          const { nodeId, tags } = message;
          const tree = await storageManager.getGlobalTree();
          if (tree.setTags(nodeId, tags)) {
            await storageManager.saveGlobalTree(tree);
            notifyGlobalTreeUpdate(tree);
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Node not found' });
          }
          break;
        }
        
        case 'ADD_TAG': {
          // Add a single tag to a node
          const { nodeId, tagId } = message;
          const tree = await storageManager.getGlobalTree();
          if (tree.addTag(nodeId, tagId)) {
            await storageManager.saveGlobalTree(tree);
            notifyGlobalTreeUpdate(tree);
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Node not found' });
          }
          break;
        }
        
        case 'REMOVE_TAG': {
          // Remove a single tag from a node
          const { nodeId, tagId } = message;
          const tree = await storageManager.getGlobalTree();
          if (tree.removeTag(nodeId, tagId)) {
            await storageManager.saveGlobalTree(tree);
            notifyGlobalTreeUpdate(tree);
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Node not found' });
          }
          break;
        }
        
        case 'DELETE_NODE': {
          // Delete a single node and reconnect its children to parent
          const { nodeId } = message;
          const tree = await storageManager.getGlobalTree();
          
          // Save snapshot for undo
          undoManager.saveSnapshot(tree.toJSON(), 'Delete node');
          
          const removedIds = tree.removeNodesAndReconnect([nodeId]);
          
          // Close tab for removed node
          for (const id of removedIds) {
            const tabInfo = tabManager.getTabForNodeGlobal(id);
            if (tabInfo) {
              try {
                await chrome.tabs.remove(tabInfo.tabId);
                tabManager.unregisterGlobal(tabInfo.tabId);
              } catch (e) {
                // Tab might already be closed
              }
            }
          }
          
          await storageManager.saveGlobalTree(tree);
          notifyGlobalTreeUpdate(tree);
          sendResponse({ success: true, removedCount: removedIds.length });
          break;
        }
        
        case 'DELETE_CHILDREN': {
          // Delete all children of a node (close their tabs too)
          const { nodeId } = message;
          const tree = await storageManager.getGlobalTree();
          
          // Save snapshot for undo
          undoManager.saveSnapshot(tree.toJSON(), 'Delete children');
          
          const removedIds = tree.removeChildren(nodeId);
          
          // Close tabs for removed nodes
          for (const id of removedIds) {
            const tabInfo = tabManager.getTabForNodeGlobal(id);
            if (tabInfo) {
              try {
                await chrome.tabs.remove(tabInfo.tabId);
                tabManager.unregisterGlobal(tabInfo.tabId);
              } catch (e) {
                // Tab might already be closed
              }
            }
          }
          
          await storageManager.saveGlobalTree(tree);
          notifyGlobalTreeUpdate(tree);
          sendResponse({ success: true, removedCount: removedIds.length });
          break;
        }
        
        case 'DELETE_WITH_CHILDREN': {
          // Delete a node and all its children (close their tabs too)
          const { nodeId } = message;
          const tree = await storageManager.getGlobalTree();
          
          // Save snapshot for undo
          undoManager.saveSnapshot(tree.toJSON(), 'Delete with children');
          
          const removedIds = tree.removeNodeWithChildren(nodeId);
          
          // Close tabs for removed nodes
          for (const id of removedIds) {
            const tabInfo = tabManager.getTabForNodeGlobal(id);
            if (tabInfo) {
              try {
                await chrome.tabs.remove(tabInfo.tabId);
                tabManager.unregisterGlobal(tabInfo.tabId);
              } catch (e) {
                // Tab might already be closed
              }
            }
          }
          
          await storageManager.saveGlobalTree(tree);
          notifyGlobalTreeUpdate(tree);
          sendResponse({ success: true, removedCount: removedIds.length });
          break;
        }
        
        case 'BULK_DELETE': {
          // Delete multiple nodes and reconnect their children
          const { nodeIds } = message;
          const tree = await storageManager.getGlobalTree();
          
          // Save snapshot for undo
          undoManager.saveSnapshot(tree.toJSON(), 'Delete selected');
          
          const removedIds = tree.removeNodesAndReconnect(nodeIds);
          
          // Close tabs for removed nodes
          for (const id of removedIds) {
            const tabInfo = tabManager.getTabForNodeGlobal(id);
            if (tabInfo) {
              try {
                await chrome.tabs.remove(tabInfo.tabId);
                tabManager.unregisterGlobal(tabInfo.tabId);
              } catch (e) {
                // Tab might already be closed
              }
            }
          }
          
          await storageManager.saveGlobalTree(tree);
          notifyGlobalTreeUpdate(tree);
          sendResponse({ success: true, removedCount: removedIds.length });
          break;
        }
        
        case 'BULK_CLOSE_TABS': {
          // Close tabs for multiple nodes (without removing from tree)
          const { nodeIds } = message;
          let closedCount = 0;
          
          for (const id of nodeIds) {
            const tabInfo = tabManager.getTabForNodeGlobal(id);
            if (tabInfo) {
              try {
                await chrome.tabs.remove(tabInfo.tabId);
                tabManager.unregisterGlobal(tabInfo.tabId);
                closedCount++;
              } catch (e) {
                // Tab might already be closed
              }
            }
          }
          
          // Notify update
          const tree = await storageManager.getGlobalTree();
          notifyGlobalTreeUpdate(tree);
          sendResponse({ success: true, closedCount });
          break;
        }
        
        case 'BULK_PIN': {
          // Pin multiple nodes
          const { nodeIds } = message;
          const tree = await storageManager.getGlobalTree();
          let pinnedCount = 0;
          
          for (const id of nodeIds) {
            const node = tree.findById(id);
            if (node && !node.pinned) {
              node.pinned = true;
              pinnedCount++;
            }
          }
          
          await storageManager.saveGlobalTree(tree);
          notifyGlobalTreeUpdate(tree);
          sendResponse({ success: true, pinnedCount });
          break;
        }
        
        case 'BULK_UNPIN': {
          // Unpin multiple nodes
          const { nodeIds } = message;
          const tree = await storageManager.getGlobalTree();
          let unpinnedCount = 0;
          
          for (const id of nodeIds) {
            const node = tree.findById(id);
            if (node && node.pinned) {
              node.pinned = false;
              unpinnedCount++;
            }
          }
          
          await storageManager.saveGlobalTree(tree);
          notifyGlobalTreeUpdate(tree);
          sendResponse({ success: true, unpinnedCount });
          break;
        }
        
        case 'UNDO': {
          const tree = await storageManager.getGlobalTree();
          const previousState = undoManager.undo(tree.toJSON());
          
          if (previousState) {
            // Restore tree from snapshot
            const { NavigationTree } = await import('./lib/tree.js');
            const restoredTree = NavigationTree.fromJSON(previousState);
            await storageManager.saveGlobalTree(restoredTree);
            notifyGlobalTreeUpdate(restoredTree);
            sendResponse({ success: true, state: undoManager.getState() });
          } else {
            sendResponse({ success: false, error: 'Nothing to undo' });
          }
          break;
        }
        
        case 'REDO': {
          const tree = await storageManager.getGlobalTree();
          const nextState = undoManager.redo(tree.toJSON());
          
          if (nextState) {
            // Restore tree from snapshot
            const { NavigationTree } = await import('./lib/tree.js');
            const restoredTree = NavigationTree.fromJSON(nextState);
            await storageManager.saveGlobalTree(restoredTree);
            notifyGlobalTreeUpdate(restoredTree);
            sendResponse({ success: true, state: undoManager.getState() });
          } else {
            sendResponse({ success: false, error: 'Nothing to redo' });
          }
          break;
        }
        
        case 'GET_UNDO_STATE': {
          sendResponse({ success: true, state: undoManager.getState() });
          break;
        }
        
        case 'GET_SETTINGS': {
          const settings = await storageManager.getSettings();
          sendResponse({ success: true, settings });
          break;
        }
        
        // GET_WINDOW_MULTI_TAB and SET_WINDOW_MULTI_TAB removed - always multi-tab mode
        
        case 'SAVE_SETTINGS': {
          invalidateSettingsCache();
          const settings = await storageManager.saveSettings(message.settings);
          
          // Update all trees with new capacity
          const tabIds = await storageManager.getAllTabIds();
          for (const tabId of tabIds) {
            const tree = await storageManager.getTree(tabId);
            tree.setCapacity(settings.stackCapacity);
            await storageManager.saveTree(tabId, tree);
          }
          
          const windowIds = await storageManager.getAllWindowIds();
          for (const windowId of windowIds) {
            const tree = await storageManager.getWindowTree(windowId);
            tree.setCapacity(settings.stackCapacity);
            await storageManager.saveWindowTree(windowId, tree);
          }
          
          sendResponse({ success: true, settings });
          break;
        }
        
        case 'CLEAR_TREE': {
          // Clear tree
          const tab = await chrome.tabs.get(message.tabId);
          const windowId = tab.windowId;
          const isMultiTab = await isMultiTabForWindow(windowId);
          
          if (isMultiTab) {
            // Multi-tab mode: clear GLOBAL tree and all tab mappings
            const tree = await storageManager.getGlobalTree();
            tree.clear();
            await storageManager.saveGlobalTree(tree);
            
            // Clear all global tab mappings
            tabManager.globalNodeToTab.clear();
            tabManager.globalTabToNode.clear();
            tabManager.globalLruOrder = [];
            
            notifyGlobalTreeUpdate(tree);
          } else {
            // Single-tab mode: per-window tree
            const tree = await storageManager.getWindowTree(windowId);
            tree.clear();
            await storageManager.saveWindowTree(windowId, tree);
            notifyWindowTreeUpdate(windowId, tree);
          }
          
          sendResponse({ success: true });
          break;
        }
        
        case 'OPEN_NEW_TAB': {
          // Used by content script in multi-tab mode
          const { url, windowId } = message;
          const isMultiTab = await isMultiTabForWindow(windowId);
          
          if (isMultiTab) {
            const newTab = await chrome.tabs.create({ windowId, url, active: true });
            sendResponse({ success: true, tabId: newTab.id });
          } else {
            sendResponse({ success: false, error: 'Not in multi-tab mode' });
          }
          break;
        }
        
        case 'GET_TAB_FOR_NODE': {
          // Get tab info for a node (used by context menu)
          const { windowId, nodeId } = message;
          const isMultiTab = await isMultiTabForWindow(windowId);
          
          let tabId = null;
          if (isMultiTab) {
            // Global mode: use global lookup
            const tabInfo = tabManager.getTabForNodeGlobal(nodeId);
            if (tabInfo && tabInfo.tabId) {
              tabId = tabInfo.tabId;
            }
          } else {
            // Legacy per-window mode
            tabId = tabManager.getTabForNode(windowId, nodeId);
          }
          
          if (tabId !== null) {
            try {
              const tab = await chrome.tabs.get(tabId);
              sendResponse({ success: true, tabInfo: tab });
            } catch (e) {
              // Tab no longer exists
              if (isMultiTab) {
                tabManager.unregisterGlobal(tabId);
              } else {
                tabManager.unregister(windowId, tabId);
              }
              sendResponse({ success: true, tabInfo: null });
            }
          } else {
            sendResponse({ success: true, tabInfo: null });
          }
          break;
        }
        
        case 'REMOVE_NODE': {
          // Remove a node from history (always per-window now)
          const { windowId, nodeId } = message;
          const isMultiTab = await isMultiTabForWindow(windowId);
          
          const tree = await storageManager.getWindowTree(windowId);
          tree.removeNode(nodeId);
          await storageManager.saveWindowTree(windowId, tree);
          
          if (isMultiTab) {
            // Also close the tab if open
            const tabIdForNode = tabManager.getTabForNode(windowId, nodeId);
            if (tabIdForNode !== null) {
              try {
                await chrome.tabs.remove(tabIdForNode);
              } catch (e) {
                // Tab already closed
              }
              tabManager.unregister(windowId, tabIdForNode);
            }
          }
          
          notifyWindowTreeUpdate(windowId, tree);
          sendResponse({ success: true });
          break;
        }
        
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true; // Keep channel open for async response
});

/**
 * Enable side panel to open on extension icon click.
 */
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

/**
 * Track tab activation for LRU in multi-tab mode.
 * Also update currentNode when user switches tabs via browser.
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { tabId, windowId } = activeInfo;
  
  // CRITICAL: Check if this tab was created programmatically FIRST, before any other operations
  // Check both in-memory set and session storage (for race condition protection)
  const isProgrammatic = programmaticTabs.has(tabId) || 
    (await chrome.storage.session.get(`programmaticTab_${tabId}`))[`programmaticTab_${tabId}`];
  
  if (isProgrammatic) {
    // This tab was created programmatically - do NOT update currentNode, do NOT notify
    // Remove flag so if user manually switches to it later, focus will switch normally
    programmaticTabs.delete(tabId);
    await chrome.storage.session.remove(`programmaticTab_${tabId}`);
    return; // Exit early - do nothing
  }
  
  const isMultiTab = await isMultiTabForWindow(windowId);
  
  if (isMultiTab) {
    // Try to find node for this tab (GLOBAL lookup)
    let nodeId = tabManager.getNodeForTabGlobal(tabId);
    
    // If not registered, try to find by URL (first in current window's tree, then globally)
    if (nodeId === null) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.url) {
          const tree = await storageManager.getGlobalTree();
          
          // First, try to find in current window's root
          let nodeByUrl = null;
          try {
            const windowTabs = await chrome.tabs.query({ windowId });
            const windowNodeIds = new Set();
            for (const wt of windowTabs) {
              const nid = tabManager.getNodeForTabGlobal(wt.id);
              if (nid !== null) {
                windowNodeIds.add(nid);
              }
            }
            
            let windowRoot = null;
            if (windowNodeIds.size > 0) {
              for (const nid of windowNodeIds) {
                windowRoot = tree.findRootForNode(nid);
                if (windowRoot) break;
              }
            }
            
            if (windowRoot) {
              nodeByUrl = tree.findByUrlInRoot(windowRoot, tab.url);
            }
          } catch (e) {
            // Fall through to global search
          }
          
          // If not found in window root, search globally
          if (!nodeByUrl) {
            nodeByUrl = tree.findByUrl(tab.url);
          }
          
          // CRITICAL: Only register if URL matches exactly to prevent wrong node assignment
          if (nodeByUrl && nodeByUrl.url === tab.url) {
            nodeId = nodeByUrl.id;
            tabManager.registerGlobal(nodeByUrl.id, windowId, tabId);
          }
        }
      } catch (e) {
        // Tab might not exist
      }
    }
    
    if (nodeId !== null) {
      tabManager.touchGlobal(tabId);
      
      const tree = await storageManager.getGlobalTree();
      const node = tree.findNodeById(nodeId);
      
      // CRITICAL: Verify that the node's URL matches the tab's URL before updating currentNode
      // This prevents updating currentNode to wrong node due to race conditions
      if (tree && node) {
        try {
          const tab = await chrome.tabs.get(tabId);
          const tabUrl = tab.url || tab.pendingUrl;
          
          // Only update currentNode if node URL matches tab URL
          if (tabUrl && node.url === tabUrl && tree.getCurrentId() !== nodeId) {
            tree.setCurrentById(nodeId);
            await storageManager.saveGlobalTree(tree);
            
            // Notify ALL sidepanels (global tree update)
            notifyGlobalTreeUpdate(tree);
          }
        } catch (e) {
          // Tab might not exist, skip update
        }
      }
    }
  }
});

/**
 * Handle tab being moved to a different window.
 * Need to move the node mapping and merge trees.
 */
chrome.tabs.onAttached.addListener(async (tabId, attachInfo) => {
  const { newWindowId } = attachInfo;
  const isMultiTab = await isMultiTabForWindow(newWindowId);
  
  if (!isMultiTab) return;
  
  // In global mode, just update the windowId in the global mapping
  const nodeId = tabManager.getNodeForTabGlobal(tabId);
  if (nodeId !== null) {
    // Get current tab info to find old window
    const tabInfo = tabManager.getTabForNodeGlobal(nodeId);
    if (tabInfo && tabInfo.tabId === tabId) {
      const oldWindowId = tabInfo.windowId;
      if (oldWindowId !== newWindowId) {
        // Re-register with new windowId (this will update the mapping)
        tabManager.registerGlobal(nodeId, newWindowId, tabId);
        
        // Notify all sidepanels
        const tree = await storageManager.getGlobalTree();
        notifyGlobalTreeUpdate(tree);
      }
    }
  } else {
    // Legacy per-window mode: find which window this tab came from
    let fromWindowId = null;
    let movedNodeId = null;
    
    for (const [windowId, tabToNode] of tabManager.windowTabToNode) {
      if (windowId !== newWindowId && tabToNode.has(tabId)) {
        fromWindowId = windowId;
        movedNodeId = tabToNode.get(tabId);
        break;
      }
    }
    
    if (fromWindowId !== null && movedNodeId !== null) {
      // Get the node data from the old tree
      const oldTree = await storageManager.getWindowTree(fromWindowId);
      const movedNode = oldTree.findNodeById(movedNodeId);
      
      if (movedNode) {
        // Move tab mapping (from old window to new window)
        tabManager.moveTab(fromWindowId, newWindowId, tabId);
        
        // Add node to new tree
        const newTree = await storageManager.getWindowTree(newWindowId);
        const entry = {
          url: movedNode.url,
          title: movedNode.title,
          favicon: movedNode.favicon,
          timestamp: movedNode.timestamp
        };
        const newNode = newTree.navigate(entry);
        
        // Update tab mapping with new node ID
        tabManager.register(newWindowId, newNode.id, tabId);
        
        await storageManager.saveWindowTree(newWindowId, newTree);
        notifyWindowTreeUpdate(newWindowId, newTree);
        
        // Also update old window
        notifyWindowTreeUpdate(fromWindowId, oldTree);
      }
    }
  }
});

/**
 * Handle window closed - cleanup.
 */
chrome.windows.onRemoved.addListener(async (windowId) => {
  tabManager.unregisterWindow(windowId);
  storageManager.clearWindowMultiTabOverride(windowId);
  await storageManager.removeWindowTree(windowId);
});

/**
 * Cleanup orphaned trees on service worker startup.
 */
storageManager.cleanupOrphanedTrees();

console.log('Trail service worker initialized');
