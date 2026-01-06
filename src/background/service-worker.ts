import { storageManager } from '../shared/lib/storage-manager';
import { tabManager } from './state/tab-manager';
import * as undoManager from '../shared/lib/commands';

/**
 * Service Worker for Trail extension.
 * Handles navigation tracking, tab lifecycle, and messaging.
 * Always uses multi-tab mode with forest mode enabled.
 */

// URLs to ignore (internal browser pages, extension pages) - DEPRECATED.
// const IGNORED_URL_PATTERNS = [
//   /^chrome:\/\//,
//   /^chrome-extension:\/\//,
//   /^brave:\/\//,
//   /^about:/,
//   /^edge:\/\//,
//   /^moz-extension:\/\//,
//   /^file:\/\//
// ];

const IGNORED_URL_PATTERNS = [];

// Map of navigations triggered from sidebar: `${tabId}:${url}` -> nodeId
const sidebarNavigations = new Map();

// Track last URL per tab for redirect detection
const lastTabUrl = new Map(); // tabId -> last URL
const REDIRECT_THRESHOLD_MS = 2000;

// Cache for settings to avoid repeated async calls
let cachedSettings = null;

// Track windows created specifically to reopen an existing node
const pendingNodeForWindow = new Map(); // windowId -> nodeId
// Track tabs being detached to a new window so onCreated won't spawn a new root
const pendingNodeForTab = new Map(); // tabId -> nodeId

function setWindowIdRecursive(node, windowId) {
  if (!node) return;
  node.windowId = windowId;
  if (node.children) {
    node.children.forEach(child => setWindowIdRecursive(child, windowId));
  }
}

function mergeRootInto(tree, sourceRoot, targetRoot) {
  if (!tree || !sourceRoot || !targetRoot || sourceRoot === targetRoot) return false;
  // Remove from roots list
  const idx = tree.roots.indexOf(sourceRoot);
  if (idx !== -1) {
    tree.roots.splice(idx, 1);
  }
  // Attach as child branch
  sourceRoot.isRoot = false;
  sourceRoot.parent = targetRoot;
  targetRoot.children.push(sourceRoot);
  return true;
}

/**
 * For single-tree mode: create a node under the single root (or create first root).
 */
function createNodeInSingleTree(tree, entry) {
  if (!tree) return null;
  if (tree.roots.length === 0) {
    return tree.createNewRoot(entry);
  }
  const root = tree.roots[0];
  const prev = tree.getCurrentId();
  tree.setCurrentById(root.id);
  const newNode = tree.navigate(entry, { backOnRevisit: true });
  if (prev && prev !== newNode.id) {
    tree.setCurrentById(prev);
  }
  return newNode;
}

/**
 * Ensure a node exists for the given tab; create a root if missing.
 * Used to register "New Tab"/internal pages that don't trigger navigation events.
 * @param {chrome.tabs.Tab} tab
 * @param {object} options
 * @param {boolean} [options.makeCurrent=false] - set tree current node to this tab's node
 * @param {boolean} [options.notify=false] - emit GLOBAL_TREE_UPDATED if a new node was created
 * @returns {Promise<number|null>} nodeId
 */
async function ensureNodeForTab(tab, { makeCurrent = false, notify = false } = {}) {
  try {
    // Already registered
    const existing = tabManager.getNodeForTabGlobal(tab.id);
    if (existing !== null) return existing;

    const tree = await storageManager.getGlobalTree();

    // Try match by URL if node already exists
    const tabUrl = tab.url || tab.pendingUrl || '';
    if (tabUrl) {
      const nodeByUrl = tree.findByUrl(tabUrl);
      if (nodeByUrl && nodeByUrl.url === tabUrl) {
        tabManager.registerGlobal(nodeByUrl.id, tab.windowId, tab.id);
        if (makeCurrent) {
          tree.setCurrentById(nodeByUrl.id);
        }
        await storageManager.saveGlobalTree(tree);
        if (notify) notifyGlobalTreeUpdate(tree);
        return nodeByUrl.id;
      }
    }

    // Create node in single tree (only one root allowed)
    const entryUrl = tabUrl || 'about:blank';
    const entry = {
      url: entryUrl,
      title: tab.title || entryUrl || 'New Tab',
      favicon: tab.favIconUrl || getFaviconUrl(entryUrl),
      timestamp: Date.now()
    };

    const newNode = createNodeInSingleTree(tree, entry);
    tabManager.registerGlobal(newNode.id, tab.windowId, tab.id);
    if (makeCurrent) {
      tree.setCurrentById(newNode.id);
    }
    await storageManager.saveGlobalTree(tree);
    if (notify) {
      notifyGlobalTreeUpdate(tree);
    }
    return newNode.id;
  } catch (e) {
    console.debug('ensureNodeForTab error:', e);
    return null;
  }
}

/**
 * On service-worker startup, register already-open tabs (e.g., first New Tab).
 */
async function bootstrapOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    let anyCreated = false;
    for (const tab of tabs) {
      const before = tabManager.getNodeForTabGlobal(tab.id);
      const nodeId = await ensureNodeForTab(tab, { makeCurrent: tab.active, notify: false });
      if (nodeId !== null && before === null) {
        anyCreated = true;
        // Ensure root has owner window
        const tree = await storageManager.getGlobalTree();
        const root = tree.findRootForNode(nodeId);
        if (root && !root.windowId) {
          root.windowId = tab.windowId;
          await storageManager.saveGlobalTree(tree);
        }
      }
    }
    if (anyCreated) {
      const tree = await storageManager.getGlobalTree();
      notifyGlobalTreeUpdate(tree);
    }
  } catch (e) {
    console.debug('bootstrapOpenTabs error:', e);
  }
}

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
 * Invalidate settings cache.
 */
function invalidateSettingsCache() {
  cachedSettings = null;
}

/**
 * Get owning window for a node by its root marker.
 * @param {NavigationTree} tree
 * @param {number} nodeId
 * @returns {number|null}
 */
function getOwnerWindowId(tree, nodeId) {
  const root = tree.findRootForNode(nodeId);
  return root?.windowId ?? null;
}

/**
 * Ensure the root that owns nodeId has a windowId; use mapping or fallback.
 */
function ensureRootOwner(tree, nodeId, fallbackWindowId = null) {
  const root = tree.findRootForNode(nodeId);
  if (!root) return null;
  if (root.windowId) return root.windowId;

  // Try to infer from open tabs of this node
  const tabInfo = tabManager.getTabForNodeGlobal(nodeId);
  if (tabInfo) {
    root.windowId = tabInfo.windowId;
    return root.windowId;
  }

  // Fallback to provided window
  if (fallbackWindowId !== null) {
    root.windowId = fallbackWindowId;
    return root.windowId;
  }
  return null;
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

// Track recent tab registrations for redirect detection (tabId -> timestamp)
const recentTabRegistrations = new Map();

// Track tabs created programmatically (e.g., "open in new tab") - don't auto-switch focus to them
const programmaticTabs = new Set(); // tabId -> true

/**
 * Register new tabs immediately (including chrome://newtab) so counters are correct.
 */
chrome.tabs.onCreated.addListener(async (tab) => {
  // Avoid double registration if already mapped
  await ensureNodeForTab(tab, { makeCurrent: tab.active, notify: true });
});

// Remember which node is being detached so a new window won't spawn a new tree
chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
  const nodeId = tabManager.getNodeForTabGlobal(tabId);
  if (nodeId !== null) {
    pendingNodeForTab.set(tabId, nodeId);
  }
});

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
          notifyGlobalTreeUpdate(tree);
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
        notifyGlobalTreeUpdate(tree);
      } else {
        // Check if this is a redirect
        const lastRegistration = recentTabRegistrations.get(tabId);
        const isRedirect = (lastRegistration && (Date.now() - lastRegistration < REDIRECT_THRESHOLD_MS)) || isFromBlankUrl;

        // Always forest mode: each new tab creates its own tree root (unless redirect)
        if (!isRedirect) {
          // Single tree: create under existing root
          newNode = createNodeInSingleTree(tree, entry);
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
        notifyGlobalTreeUpdate(tree);
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
async function notifyGlobalTreeUpdate(tree) {
  try {
    const openNodeIds = Array.from(tabManager.getAllOpenNodes());
    const tabStates = await getTabStates();

    // Aggregate tab counts across all windows for badge display
    const nodeTabCounts = {};
    for (const nodeId of openNodeIds) {
      const count = tabManager.getTabCountForNode(nodeId);
      if (count > 1) {
        nodeTabCounts[nodeId] = count;
      }
    }

    chrome.runtime.sendMessage({
      type: 'GLOBAL_TREE_UPDATED',
      tree: tree.toJSON(),
      openNodeIds,
      tabStates,
      nodeTabCounts
    }).catch(() => {
      // Side panel might not be open, ignore
    });
  } catch (error) {
    console.debug('Notify global error:', error);
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
    const tabUrl = tab.pendingUrl || tab.url || '';

    // If this window is created from a detached tab, reuse its node
    const detNodeId = pendingNodeForTab.get(tab.id);
    if (detNodeId !== undefined) {
      pendingNodeForTab.delete(tab.id);
      const tree = await storageManager.getGlobalTree();
      const root = tree.findRootForNode(detNodeId);
      if (root) root.windowId = window.id;
      tabManager.registerGlobal(detNodeId, window.id, tab.id);
      tree.setCurrentById(detNodeId);
      await storageManager.saveGlobalTree(tree);
      notifyGlobalTreeUpdate(tree);
      return;
    }

    // If any tab in this window is already mapped to a node, don't create another root
    for (const t of tabs) {
      const mapped = tabManager.getNodeForTabGlobal(t.id);
      if (mapped !== null) {
        // Ensure owner window is set
        const tree = await storageManager.getGlobalTree();
        const root = tree.findRootForNode(mapped);
        if (root && root.windowId !== window.id) {
          root.windowId = window.id;
          await storageManager.saveGlobalTree(tree);
        }
        return;
      }
    }

    // If this window is intended to host an existing node, just register it
    if (pendingNodeForWindow.has(window.id)) {
      const nodeId = pendingNodeForWindow.get(window.id);
      pendingNodeForWindow.delete(window.id);
      const tree = await storageManager.getGlobalTree();
      const root = tree.findRootForNode(nodeId);
      if (root) root.windowId = window.id;
      tabManager.registerGlobal(nodeId, window.id, tab.id);
      tree.setCurrentById(nodeId);
      await storageManager.saveGlobalTree(tree);
      notifyGlobalTreeUpdate(tree);
      return;
    }

    // Register tab in single tree
    const tree = await storageManager.getGlobalTree();
    const entry = {
      url: tabUrl,
      title: tab.title || '',
      favicon: tab.favIconUrl || ''
    };
    const node = createNodeInSingleTree(tree, entry);
    tabManager.registerGlobal(node.id, window.id, tab.id);
    await storageManager.saveGlobalTree(tree);
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
          
          try {
            // Always multi-tab mode - use GLOBAL tree
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
  
  // If tab not registered, try to find node by URL globally, otherwise create placeholder
          if (activeNodeId === null) {
            if (tab.url) {
              const nodeByUrl = tree.findByUrl(tab.url);
              
              // CRITICAL: Only use node if URL matches exactly
              if (nodeByUrl && nodeByUrl.url === tab.url) {
                activeNodeId = nodeByUrl.id;
                tabManager.registerGlobal(nodeByUrl.id, tab.windowId, tab.id);
                
                // Update currentNode
                tree.setCurrentById(activeNodeId);
                await storageManager.saveGlobalTree(tree);
              } else {
                activeNodeId = await ensureNodeForTab(tab, { makeCurrent: true, notify: true });
              }
            } else {
              activeNodeId = await ensureNodeForTab(tab, { makeCurrent: true, notify: true });
            }
          }
          
          // Update currentNode if we found the node and URL matches
          if (activeNodeId !== null) {
            const node = tree.findNodeById(activeNodeId);
            if (node && node.url === tab.url && tree.getCurrentId() !== activeNodeId) {
              tree.setCurrentById(activeNodeId);
              await storageManager.saveGlobalTree(tree);
            }
            ensureRootOwner(tree, activeNodeId, tab.windowId);
          }
          
          const openNodeIds = Array.from(tabManager.getAllOpenNodes());
          const tabStates = await getTabStates();
          
          // Calculate tab counts across all windows
          const nodeTabCounts = {};
          for (const nodeId of openNodeIds) {
            const count = tabManager.getTabCountForNode(nodeId);
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
          const ownerWindowId = ensureRootOwner(tree, nodeId, windowId);
          
          // Cycle through open tabs for this node (across all windows)
          const tabsForNode = tabManager.getTabsForNode(nodeId);
          if (tabsForNode.length > 1) {
            const nextTab = tabManager.getNextTabForNode(nodeId, tabId);
            if (nextTab) {
              try {
                await chrome.windows.update(nextTab.windowId, { focused: true });
                await chrome.tabs.update(nextTab.tabId, { active: true });
                tabManager.touchGlobal(nextTab.tabId);
                tree.setCurrentById(nodeId);
                await storageManager.saveGlobalTree(tree);
                notifyGlobalTreeUpdate(tree);
                sendResponse({ success: true });
                break;
              } catch (e) {
                // Tab may have closed; fall through to open logic
              }
            }
          }
          
          // Try focusing an existing tab for this node
          const existing = tabManager.getTabForNodeGlobal(nodeId);
          if (existing !== null) {
            try {
              await chrome.windows.update(existing.windowId, { focused: true });
              await chrome.tabs.update(existing.tabId, { active: true });
              tabManager.touchGlobal(existing.tabId);
            } catch (e) {
              tabManager.unregisterGlobal(existing.tabId);
            }
          }
          
          // If no tab is open, create one in owning window (or new window)
          if (tabManager.getTabForNodeGlobal(nodeId) === null) {
            let targetWindowId = ownerWindowId || windowId;
            let targetWindowExists = false;
            if (targetWindowId) {
              try {
                await chrome.windows.get(targetWindowId);
                targetWindowExists = true;
              } catch (e) {
                targetWindowExists = false;
              }
            }
            
            if (!targetWindowExists) {
              const newWindow = await chrome.windows.create({ focused: true, url });
              targetWindowId = newWindow.id;
              pendingNodeForWindow.set(targetWindowId, nodeId);
              const root = tree.findRootForNode(nodeId);
              if (root) root.windowId = targetWindowId;
              const tabs = await chrome.tabs.query({ windowId: newWindow.id });
              const newTab = tabs[0];
              tabManager.registerGlobal(nodeId, targetWindowId, newTab.id);
            } else {
              const newTab = await chrome.tabs.create({ windowId: targetWindowId, url, active: true });
              tabManager.registerGlobal(nodeId, targetWindowId, newTab.id);
            }
            
            // Enforce tab limit globally (skip pinned nodes)
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
            
            // Always multi-tab mode
            tabManager.registerGlobal(nodeId, tab.windowId, tab.id);
            // DO NOT update currentNode - keep focus on current tab
            // But DO notify to update tab count badge immediately
            await storageManager.saveGlobalTree(tree);
            notifyGlobalTreeUpdate(tree);
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Node not found' });
          }
          break;
        }
        
        case 'CREATE_NEW_ROOT': {
          // Disabled: single-tree mode; no additional roots/windows
          sendResponse({ success: false, error: 'Single-tree mode: new roots disabled' });
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
          
          sendResponse({ success: true, settings });
          break;
        }
        
        case 'CLEAR_TREE': {
          // Clear tree
          const tree = await storageManager.getGlobalTree();
          tree.clear();
          await storageManager.saveGlobalTree(tree);
          
          // Clear all global tab mappings
          tabManager.globalNodeToTab.clear();
          tabManager.globalNodeTabs.clear();
          tabManager.globalTabToNode.clear();
          tabManager.globalLruOrder = [];
          
          notifyGlobalTreeUpdate(tree);
          sendResponse({ success: true });
          break;
        }
        
        case 'OPEN_NEW_TAB': {
          // Used by content script in multi-tab mode
          const { url, windowId } = message;
          const newTab = await chrome.tabs.create({ windowId, url, active: true });
          sendResponse({ success: true, tabId: newTab.id });
          break;
        }
        
        case 'GET_TAB_FOR_NODE': {
          // Get tab info for a node (used by context menu)
          const { nodeId } = message;
          
          let tabId = null;
          const tabInfo = tabManager.getTabForNodeGlobal(nodeId);
          if (tabInfo && tabInfo.tabId) {
            tabId = tabInfo.tabId;
          }
          
          if (tabId !== null) {
            try {
              const tab = await chrome.tabs.get(tabId);
              sendResponse({ success: true, tabInfo: tab });
            } catch (e) {
              // Tab no longer exists
              tabManager.unregisterGlobal(tabId);
              sendResponse({ success: true, tabInfo: null });
            }
          } else {
            sendResponse({ success: true, tabInfo: null });
          }
          break;
        }
        
        case 'REMOVE_NODE': {
          // Remove a node from history (global graph)
          const { nodeId } = message;
          
          const tree = await storageManager.getGlobalTree();
          tree.removeNode(nodeId);
          await storageManager.saveGlobalTree(tree);
          
          // Close any tabs bound to this node
          const tabsForNode = tabManager.getTabsForNode(nodeId);
          for (const tab of tabsForNode) {
            try {
              await chrome.tabs.remove(tab.tabId);
            } catch (e) {
              // Tab already closed
            }
            tabManager.unregisterGlobal(tab.tabId);
          }
          
          notifyGlobalTreeUpdate(tree);
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
  
  // Try to find node for this tab (GLOBAL lookup)
  let nodeId = tabManager.getNodeForTabGlobal(tabId);
  
  // If not registered, try to find by URL globally, otherwise create placeholder
  if (nodeId === null) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const tree = await storageManager.getGlobalTree();
      if (tab.url) {
        const nodeByUrl = tree.findByUrl(tab.url);
        
        // Only register if URL matches exactly
        if (nodeByUrl && nodeByUrl.url === tab.url) {
          nodeId = nodeByUrl.id;
          tabManager.registerGlobal(nodeByUrl.id, windowId, tabId);
        } else {
          nodeId = await ensureNodeForTab(tab, { makeCurrent: true, notify: true });
        }
      } else {
        nodeId = await ensureNodeForTab(tab, { makeCurrent: true, notify: true });
      }
    } catch (e) {
      // Tab might not exist
    }
  }
  
  if (nodeId !== null) {
    tabManager.touchGlobal(tabId);
    
    const tree = await storageManager.getGlobalTree();
    const node = tree.findNodeById(nodeId);
    
    // Verify URL match before updating current node
    if (tree && node) {
      try {
        const tab = await chrome.tabs.get(tabId);
        const tabUrl = tab.url || tab.pendingUrl;
        
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
});

/**
 * Handle tab being moved to a different window.
 * Need to move the node mapping and merge trees.
 */
chrome.tabs.onAttached.addListener(async (tabId, attachInfo) => {
  const { newWindowId } = attachInfo;
  
  // Try mapping first
  let nodeId = tabManager.getNodeForTabGlobal(tabId);
  // Fallback to pending map from detach
  if (nodeId === null && pendingNodeForTab.has(tabId)) {
    nodeId = pendingNodeForTab.get(tabId);
    pendingNodeForTab.delete(tabId);
  }

  // If still unknown, attempt to register/ensure
  if (nodeId === null) {
    try {
      const tab = await chrome.tabs.get(tabId);
      nodeId = await ensureNodeForTab(tab, { makeCurrent: true, notify: false });
    } catch (e) {}
  }

  if (nodeId !== null) {
    // Ensure mapping uses new window id
    tabManager.registerGlobal(nodeId, newWindowId, tabId);

    // Update tree owner to new window
    const tree = await storageManager.getGlobalTree();
    const root = tree.findRootForNode(nodeId);
    if (root) {
      setWindowIdRecursive(root, newWindowId);

      // Try to merge with existing root of target window (use active tab in that window)
      let targetRoot = null;
      try {
        const [activeTab] = await chrome.tabs.query({ windowId: newWindowId, active: true });
        if (activeTab) {
          const activeNodeId = tabManager.getNodeForTabGlobal(activeTab.id);
          if (activeNodeId !== null) {
            targetRoot = tree.findRootForNode(activeNodeId);
          }
        }
      } catch {}

      if (!targetRoot) {
        // fallback: any root with same windowId
        targetRoot = tree.roots.find(r => r.windowId === newWindowId);
      }

      if (targetRoot && targetRoot !== root) {
        mergeRootInto(tree, root, targetRoot);
      }

      await storageManager.saveGlobalTree(tree);
    }
    
    // Notify all sidepanels
    notifyGlobalTreeUpdate(tree);
  }
});

/**
 * Cleanup orphaned trees on service worker startup.
 */
storageManager.cleanupOrphanedTrees();

// Ensure already-open tabs (including the first New Tab) are tracked at startup.
bootstrapOpenTabs();

console.log('Trail service worker initialized');
