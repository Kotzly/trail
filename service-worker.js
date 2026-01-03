import { storageManager } from './lib/storage-manager.js';
import { tabManager } from './lib/tab-manager.js';

/**
 * Service Worker for Trail extension.
 * Handles navigation tracking, tab lifecycle, and messaging.
 * Supports both single-tab and multi-tab modes.
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
 * Uses per-window override if set, otherwise global setting.
 * @param {number} windowId
 * @returns {Promise<boolean>}
 */
async function isMultiTabForWindow(windowId) {
  return storageManager.isMultiTabEnabledForWindow(windowId);
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
 * Supports both single-tab and multi-tab modes.
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
  
  const isMultiTab = await isMultiTabForWindow(windowId);
  
  if (isMultiTab) {
    await handleMultiTabNavigation(details, transitionType, windowId);
  } else {
    await handleSingleTabNavigation(details, transitionType, windowId);
  }
}

/**
 * Handle navigation in single-tab mode (original behavior).
 * Now uses per-window trees instead of per-tab.
 */
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

    // Detect rapid same-origin navigations (e.g., YouTube Shorts infinite scroll)
    const prevUrl = lastTabUrl.get(tabId);
    const timeSinceLastNav = Date.now() - (lastNavTime.get(tabId) || 0);

    if (prevUrl && timeSinceLastNav < RAPID_NAV_THRESHOLD_MS && prevUrl !== 'about:blank') {
      try {
        const lastUrl = new URL(prevUrl);
        const currentUrl = new URL(url);

        if (lastUrl.origin === currentUrl.origin) {
          const lastPathBase = lastUrl.pathname.split('/')[1];
          const currentPathBase = currentUrl.pathname.split('/')[1];

          if (lastPathBase && lastPathBase === currentPathBase) {
            const tree = await storageManager.getWindowTree(windowId);
            const currentNode = tree.currentNode;

            if (currentNode) {
              currentNode.url = url;
              currentNode.title = tab.title || url;
              currentNode.timestamp = Date.now();
              lastTabUrl.set(tabId, url);
              lastNavTime.set(tabId, Date.now());
              await storageManager.saveWindowTree(windowId, tree);
              notifyWindowTreeUpdate(windowId, tree);
              return;
            }
          }
        }
      } catch (e) {
        // Invalid URL, continue with normal handling
      }
    }

    lastTabUrl.set(tabId, url);
    lastNavTime.set(tabId, Date.now());

    const entry = {
      url,
      title: tab.title || url,
      favicon: tab.favIconUrl || getFaviconUrl(url),
      timestamp: Date.now()
    };

    const tree = await storageManager.getWindowTree(windowId);
    tree.navigate(entry);
    await storageManager.saveWindowTree(windowId, tree);

    notifyWindowTreeUpdate(windowId, tree);
  } catch (error) {
    console.debug('Navigation handling error:', error);
  }
}


// Track recent tab registrations for redirect detection (tabId -> timestamp)
const recentTabRegistrations = new Map();
const lastTabUrl = new Map(); // tabId -> last URL
const lastNavTime = new Map(); // tabId -> timestamp of last navigation
const REDIRECT_THRESHOLD_MS = 2000; // Redirects within 2 seconds are treated as same navigation
const RAPID_NAV_THRESHOLD_MS = 500; // Rapid navigations within 500ms (infinite scroll detection)

/**
 * Handle navigation in multi-tab mode.
 * Each page is tracked per-window, tabs are mapped to nodes.
 */
async function handleMultiTabNavigation(details, transitionType, windowId) {
  const { tabId, url } = details;

  // Skip about:blank - just track it for redirect detection, don't create nodes
  if (url === 'about:blank') {
    lastTabUrl.set(tabId, url);
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    const settings = await getSettings();

    // Detect rapid same-origin navigations (e.g., YouTube Shorts infinite scroll)
    // Update current node instead of creating duplicates
    const prevUrl = lastTabUrl.get(tabId);
    const timeSinceLastNav = Date.now() - (lastNavTime.get(tabId) || 0);

    if (prevUrl && timeSinceLastNav < RAPID_NAV_THRESHOLD_MS && prevUrl !== 'about:blank') {
      try {
        const lastUrl = new URL(prevUrl);
        const currentUrl = new URL(url);

        // Same origin + same first path segment = likely infinite scroll (e.g., /shorts/abc -> /shorts/xyz)
        if (lastUrl.origin === currentUrl.origin) {
          const lastPathBase = lastUrl.pathname.split('/')[1];
          const currentPathBase = currentUrl.pathname.split('/')[1];

          if (lastPathBase && lastPathBase === currentPathBase) {
            // Update current node URL instead of creating new node
            const tree = await storageManager.getWindowTree(windowId);
            const currentNode = tree.currentNode;

            if (currentNode) {
              currentNode.url = url;
              currentNode.title = tab.title || url;
              currentNode.timestamp = Date.now();
              lastTabUrl.set(tabId, url);
              lastNavTime.set(tabId, Date.now());
              await storageManager.saveWindowTree(windowId, tree);
              notifyWindowTreeUpdate(windowId, tree);
              return;
            }
          }
        }
      } catch (e) {
        // Invalid URL, continue with normal handling
      }
    }

    // Update tracking
    lastTabUrl.set(tabId, url);
    lastNavTime.set(tabId, Date.now());

    // Check if this tab is already registered to a node
    const existingNodeId = tabManager.getNodeForTab(windowId, tabId);
    
    const entry = {
      url,
      title: tab.title || url,
      favicon: tab.favIconUrl || getFaviconUrl(url),
      timestamp: Date.now()
    };

    const tree = await storageManager.getWindowTree(windowId);

    // --- about:blank redirect logic ---
    // Note: prevUrl and lastTabUrl already tracked above for infinite scroll detection
    const isFromAboutBlank = prevUrl === 'about:blank';

    if (existingNodeId !== null) {
      // Tab already has a node - navigate from that node (creates a branch if different URL)
      const node = tree.findNodeById(existingNodeId);
      if (node && node.url !== url) {
        // Different URL - navigate from current node
        tree.setCurrentById(existingNodeId);
        const newNode = tree.navigate(entry);
        // Re-register tab with new node
        tabManager.register(windowId, newNode.id, tabId);
      } else if (node) {
        // Same URL - just update current
        tree.setCurrentById(existingNodeId);
      }
      tabManager.touch(windowId, tabId);
    } else {
      // New tab without existing node
      let newNode;
      
      // Check if this is a redirect (tab was recently registered with another URL)
      const lastRegistration = recentTabRegistrations.get(tabId);
      const isRedirect = (lastRegistration && (Date.now() - lastRegistration < REDIRECT_THRESHOLD_MS)) || isFromAboutBlank;
      
      // Decide: create new root (forest mode) or branch from current
      if (settings.forestMode && !isRedirect) {
        // Forest mode: each new tab creates its own tree
        newNode = tree.createNewRoot(entry);
      } else {
        // Single-tree mode OR redirect: branch from current node
        newNode = tree.navigate(entry);
      }
      
      tabManager.register(windowId, newNode.id, tabId);
      recentTabRegistrations.set(tabId, Date.now());
      
      // Cleanup old entries from recentTabRegistrations (prevent memory leak)
      if (recentTabRegistrations.size > 100) {
        const now = Date.now();
        for (const [tid, time] of recentTabRegistrations) {
          if (now - time > REDIRECT_THRESHOLD_MS * 2) {
            recentTabRegistrations.delete(tid);
          }
        }
      }
      
      // Check tab limit
      await tabManager.closeOldestIfNeeded(windowId, settings.multiTabLimit);
    }

    await storageManager.saveWindowTree(windowId, tree);
    notifyWindowTreeUpdate(windowId, tree);
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
chrome.webNavigation.onCommitted.addListener((details) => {
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
    
    if (settings.multiTabEnabled) {
      // Multi-tab mode: update window tree
      const windowId = tab.windowId;
      const nodeId = tabManager.getNodeForTab(windowId, tabId);
      if (nodeId !== null) {
        const tree = await storageManager.getWindowTree(windowId);
        const node = tree.findNodeById(nodeId);
        if (node && tab.title && tab.title !== node.title) {
          node.title = tab.title;
          node.favicon = tab.favIconUrl || node.favicon;
          await storageManager.saveWindowTree(windowId, tree);
          notifyWindowTreeUpdate(windowId, tree);
        }
      }
    } else {
      // Single-tab mode: update tab tree
      const tree = await storageManager.getTree(tabId);
      const currentNode = tree.currentNode;
      if (currentNode && currentNode.url === url && tab.title && tab.title !== currentNode.title) {
        currentNode.title = tab.title;
        currentNode.favicon = tab.favIconUrl || currentNode.favicon;
        await storageManager.saveTree(tabId, tree);
        notifyTreeUpdate(tabId);
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
  const settings = await getSettings();
  
  if (settings.multiTabEnabled) {
    // Multi-tab mode: unregister from tab manager (keep node in tree)
    const windowId = removeInfo.windowId;
    if (windowId) {
      tabManager.unregister(windowId, tabId);
    }
    // Notify to update closed state
    if (windowId) {
      try {
        const tree = await storageManager.getWindowTree(windowId);
        notifyWindowTreeUpdate(windowId, tree);
      } catch (e) {}
    }
  } else {
    // Single-tab mode: remove tree
    storageManager.removeTree(tabId);
  }
});

/**
 * Cleanup when window is closed.
 */
chrome.windows.onRemoved.addListener(async (windowId) => {
  const settings = await getSettings();
  
  if (settings.multiTabEnabled) {
    tabManager.unregisterWindow(windowId);
    await storageManager.removeWindowTree(windowId);
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
          tree.navigate(entry);
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
              // Multi-tab mode
              const windowId = sender.tab.windowId;
              const nodeId = tabManager.getNodeForTab(windowId, tabId);
              if (nodeId !== null) {
                const tree = await storageManager.getWindowTree(windowId);
                const node = tree.findNodeById(nodeId);
                if (node && node.url === url && node.title !== newTitle) {
                  node.title = newTitle;
                  await storageManager.saveWindowTree(windowId, tree);
                  notifyWindowTreeUpdate(windowId, tree);
                }
              }
            } else {
              // Single-tab mode
              const tree = await storageManager.getTree(tabId);
              const currentNode = tree.currentNode;
              if (currentNode && currentNode.url === url && currentNode.title !== newTitle) {
                currentNode.title = newTitle;
                await storageManager.saveTree(tabId, tree);
                notifyTreeUpdate(tabId);
              }
            }
          } catch (error) {
            console.debug('Title update error:', error);
          }
          break;
        }
        
        case 'GET_TREE': {
          // Get window tree (per-window trees for both modes now)
          const tab = await chrome.tabs.get(message.tabId);
          const isMultiTab = await isMultiTabForWindow(tab.windowId);
          const tree = await storageManager.getWindowTree(tab.windowId);
          
          if (isMultiTab) {
            // Try to find node for active tab
            let activeNodeId = tabManager.getNodeForTab(tab.windowId, tab.id);
            
            // If tab not registered, try to find node by URL and register it
            if (activeNodeId === null && tab.url) {
              const nodeByUrl = tree.findByUrl(tab.url);
              if (nodeByUrl) {
                activeNodeId = nodeByUrl.id;
                tabManager.register(tab.windowId, activeNodeId, tab.id);
              }
            }
            
            // Update currentNode if we found the node
            if (activeNodeId !== null && tree.getCurrentId() !== activeNodeId) {
              tree.setCurrentById(activeNodeId);
              await storageManager.saveWindowTree(tab.windowId, tree);
            }
            
            const openNodeIds = Array.from(tabManager.getOpenNodesForWindow(tab.windowId));
            sendResponse({ 
              success: true, 
              tree: tree.toJSON(),
              openNodeIds,
              multiTabMode: true,
              windowId: tab.windowId
            });
          } else {
            sendResponse({ 
              success: true, 
              tree: tree.toJSON(),
              multiTabMode: false,
              windowId: tab.windowId
            });
          }
          break;
        }
        
        case 'GET_WINDOW_TREE': {
          const tree = await storageManager.getWindowTree(message.windowId);
          const openNodeIds = Array.from(tabManager.getOpenNodesForWindow(message.windowId));
          sendResponse({ 
            success: true, 
            tree: tree.toJSON(),
            openNodeIds
          });
          break;
        }
        
        case 'GET_CURRENT_TAB': {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          sendResponse({ success: true, tab });
          break;
        }
        
        case 'IS_MULTI_TAB_MODE': {
          // Called by content script to check if multi-tab is enabled for its window
          if (sender.tab) {
            const enabled = await isMultiTabForWindow(sender.tab.windowId);
            sendResponse({ success: true, enabled });
          } else {
            const settings = await getSettings();
            sendResponse({ success: true, enabled: settings.multiTabEnabled });
          }
          break;
        }
        
        case 'NAVIGATE_TO': {
          const { windowId, nodeId, url, tabId } = message;
          const isMultiTab = await isMultiTabForWindow(windowId);
          const settings = await getSettings();
          
          if (isMultiTab) {
            // Multi-tab mode: activate existing tab or create new one
            const existingTabId = tabManager.getTabForNode(windowId, nodeId);

            if (existingTabId !== null) {
              // Tab exists - focus window and activate tab
              try {
                await chrome.windows.update(windowId, { focused: true });
                await chrome.tabs.update(existingTabId, { active: true });
                tabManager.touch(windowId, existingTabId);
              } catch (e) {
                // Tab might have been closed externally
                tabManager.unregister(windowId, existingTabId);
                // Create new tab
                const newTab = await chrome.tabs.create({ windowId, url, active: true });
                tabManager.register(windowId, nodeId, newTab.id);
              }
            } else {
              // No tab - create new one
              const newTab = await chrome.tabs.create({ windowId, url, active: true });
              tabManager.register(windowId, nodeId, newTab.id);
              
              // Check limit
              await tabManager.closeOldestIfNeeded(windowId, settings.multiTabLimit);
            }
            
            // Update current node in tree
            const tree = await storageManager.getWindowTree(windowId);
            tree.setCurrentById(nodeId);
            await storageManager.saveWindowTree(windowId, tree);
            notifyWindowTreeUpdate(windowId, tree);
            
            sendResponse({ success: true });
          } else {
            // Single-tab mode (per-window tree)
            sidebarNavigations.set(`${windowId}:${url}`, nodeId);
            setTimeout(() => {
              sidebarNavigations.delete(`${windowId}:${url}`);
            }, 5000);
            
            const tree = await storageManager.getWindowTree(windowId);
            const currentNode = tree.currentNode;
            
            let navigated = false;
            
            if (currentNode && tabId) {
              try {
                const currentUrl = new URL(currentNode.url);
                const targetUrl = new URL(url);
                
                if (currentUrl.origin === targetUrl.origin) {
                  if (currentUrl.pathname === targetUrl.pathname && 
                      currentUrl.search === targetUrl.search &&
                      targetUrl.hash) {
                    await chrome.scripting.executeScript({
                      target: { tabId },
                      func: (fullUrl) => { window.location.href = fullUrl; },
                      args: [url]
                    });
                    navigated = true;
                  }
                }
              } catch (e) {}
            }
            
            if (!navigated && tabId) {
              await chrome.tabs.update(tabId, { url });
            }
            
            tree.setCurrentById(nodeId);
            await storageManager.saveWindowTree(windowId, tree);
            notifyWindowTreeUpdate(windowId, tree);
            
            sendResponse({ success: true });
          }
          break;
        }
        
        case 'GET_SETTINGS': {
          const settings = await storageManager.getSettings();
          sendResponse({ success: true, settings });
          break;
        }
        
        case 'GET_WINDOW_MULTI_TAB': {
          // Get whether multi-tab is enabled for a specific window
          const { windowId } = message;
          const globalSettings = await storageManager.getSettings();
          const override = storageManager.getWindowMultiTabOverride(windowId);
          const isEnabled = await isMultiTabForWindow(windowId);
          
          sendResponse({ 
            success: true, 
            enabled: isEnabled,
            globalEnabled: globalSettings.multiTabEnabled,
            hasOverride: override !== null,
            override
          });
          break;
        }
        
        case 'SET_WINDOW_MULTI_TAB': {
          // Set per-window multi-tab override
          const { windowId, enabled } = message;
          const globalSettings = await storageManager.getSettings();
          
          if (enabled === globalSettings.multiTabEnabled) {
            // Same as global - clear override
            storageManager.clearWindowMultiTabOverride(windowId);
          } else {
            // Different from global - set override
            storageManager.setWindowMultiTabOverride(windowId, enabled);
          }
          
          sendResponse({ success: true });
          break;
        }
        
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
          // Clear tree for window (always per-window now)
          const tab = await chrome.tabs.get(message.tabId);
          const windowId = tab.windowId;
          const isMultiTab = await isMultiTabForWindow(windowId);
          
          const tree = await storageManager.getWindowTree(windowId);
          tree.clear();
          await storageManager.saveWindowTree(windowId, tree);
          
          if (isMultiTab) {
            // Also clear tab mappings for this window
            tabManager.unregisterWindow(windowId);
          }
          
          notifyWindowTreeUpdate(windowId, tree);
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
          const tabId = tabManager.getTabForNode(windowId, nodeId);
          
          if (tabId !== null) {
            try {
              const tab = await chrome.tabs.get(tabId);
              sendResponse({ success: true, tabInfo: tab });
            } catch (e) {
              // Tab no longer exists
              tabManager.unregister(windowId, tabId);
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
  const isMultiTab = await isMultiTabForWindow(windowId);
  
  if (isMultiTab) {
    // Try to find node for this tab
    let nodeId = tabManager.getNodeForTab(windowId, tabId);
    
    // If not registered, try to find by URL
    if (nodeId === null) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.url) {
          const tree = await storageManager.getWindowTree(windowId);
          const nodeByUrl = tree.findByUrl(tab.url);
          if (nodeByUrl) {
            nodeId = nodeByUrl.id;
            tabManager.register(windowId, nodeId, tabId);
          }
        }
      } catch (e) {
        // Tab might not exist
      }
    }
    
    if (nodeId !== null) {
      tabManager.touch(windowId, tabId);
      
      const tree = await storageManager.getWindowTree(windowId);
      if (tree && tree.getCurrentId() !== nodeId) {
        tree.setCurrentById(nodeId);
        await storageManager.saveWindowTree(windowId, tree);
        
        // Notify sidepanel
        notifyWindowTreeUpdate(windowId, tree);
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
  
  // Find which window this tab came from
  // We need to check all windows in tabManager
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
