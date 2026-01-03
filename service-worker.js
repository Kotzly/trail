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

  const settings = await getSettings();
  
  if (settings.multiTabEnabled) {
    await handleMultiTabNavigation(details, transitionType);
  } else {
    await handleSingleTabNavigation(details, transitionType);
  }
}

/**
 * Handle navigation in single-tab mode (original behavior).
 */
async function handleSingleTabNavigation(details, transitionType) {
  const { tabId, url } = details;

  // Skip back/forward navigation - find existing node
  if (details.transitionQualifiers?.includes('forward_back')) {
    try {
      const tree = await storageManager.getTree(tabId);
      const node = tree.findByUrl(url);
      if (node) {
        tree.setCurrentById(node.id);
        await storageManager.saveTree(tabId, tree);
        notifyTreeUpdate(tabId);
      }
    } catch (error) {
      console.debug('Back/forward navigation error:', error);
    }
    return;
  }

  // Check if this navigation was triggered by clicking in sidebar
  const navKey = `${tabId}:${url}`;
  if (sidebarNavigations.has(navKey)) {
    const nodeId = sidebarNavigations.get(navKey);
    sidebarNavigations.delete(navKey);
    try {
      const tree = await storageManager.getTree(tabId);
      tree.setCurrentById(nodeId);
      await storageManager.saveTree(tabId, tree);
      notifyTreeUpdate(tabId);
    } catch (error) {
      console.debug('Sidebar navigation update error:', error);
    }
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    
    const entry = {
      url,
      title: tab.title || url,
      favicon: tab.favIconUrl || getFaviconUrl(url),
      timestamp: Date.now()
    };

    const tree = await storageManager.getTree(tabId);
    tree.navigate(entry);
    await storageManager.saveTree(tabId, tree);

    notifyTreeUpdate(tabId);
  } catch (error) {
    console.debug('Navigation handling error:', error);
  }
}

/**
 * Handle navigation in multi-tab mode.
 * Each page is tracked per-window, tabs are mapped to nodes.
 */
async function handleMultiTabNavigation(details, transitionType) {
  const { tabId, url } = details;

  try {
    const tab = await chrome.tabs.get(tabId);
    const windowId = tab.windowId;
    const settings = await getSettings();

    // Check if this tab is already registered to a node
    const existingNodeId = tabManager.getNodeForTab(tabId);
    
    const entry = {
      url,
      title: tab.title || url,
      favicon: tab.favIconUrl || getFaviconUrl(url),
      timestamp: Date.now()
    };

    const tree = await storageManager.getWindowTree(windowId);
    
    if (existingNodeId !== undefined) {
      // Tab already has a node - update it (in-tab navigation)
      const node = tree._findById(tree.root, existingNodeId);
      if (node) {
        // Navigate from this node (creates a branch)
        const newNode = tree.navigate(entry);
        // Re-register tab with new node
        tabManager.register(windowId, newNode.id, tabId);
        tabManager.touch(windowId, tabId);
      }
    } else {
      // New tab - create new node
      const newNode = tree.navigate(entry);
      tabManager.register(windowId, newNode.id, tabId);
      
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
      const nodeId = tabManager.getNodeForTab(tabId);
      if (nodeId !== undefined) {
        const tree = await storageManager.getWindowTree(windowId);
        const node = tree._findById(tree.root, nodeId);
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
    tabManager.unregister(tabId);
    // Notify to update closed state
    const windowId = removeInfo.windowId;
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
              const nodeId = tabManager.getNodeForTab(tabId);
              if (nodeId !== undefined) {
                const tree = await storageManager.getWindowTree(windowId);
                const node = tree._findById(tree.root, nodeId);
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
          const settings = await getSettings();
          
          if (settings.multiTabEnabled) {
            // Multi-tab mode: get window tree
            const tab = await chrome.tabs.get(message.tabId);
            const tree = await storageManager.getWindowTree(tab.windowId);
            const openNodeIds = Array.from(tabManager.getOpenNodesForWindow(tab.windowId));
            sendResponse({ 
              success: true, 
              tree: tree.toJSON(),
              openNodeIds,
              multiTabMode: true,
              windowId: tab.windowId
            });
          } else {
            // Single-tab mode
            const tree = await storageManager.getTree(message.tabId);
            sendResponse({ success: true, tree: tree.toJSON() });
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
        
        case 'NAVIGATE_TO': {
          const settings = await getSettings();
          
          if (settings.multiTabEnabled) {
            // Multi-tab mode: activate existing tab or create new one
            const { windowId, nodeId, url } = message;
            const existingTabId = tabManager.getTabForNode(nodeId);
            
            if (existingTabId !== undefined) {
              // Tab exists - activate it
              try {
                await chrome.tabs.update(existingTabId, { active: true });
                tabManager.touch(windowId, existingTabId);
              } catch (e) {
                // Tab might have been closed externally
                tabManager.unregister(existingTabId);
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
            // Single-tab mode (existing logic)
            const { tabId, url, nodeId } = message;
            
            sidebarNavigations.set(`${tabId}:${url}`, nodeId);
            setTimeout(() => {
              sidebarNavigations.delete(`${tabId}:${url}`);
            }, 5000);
            
            const tree = await storageManager.getTree(tabId);
            const currentNode = tree.currentNode;
            
            let navigated = false;
            
            if (currentNode) {
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
            
            if (!navigated) {
              await chrome.tabs.update(tabId, { url });
            }
            
            tree.setCurrentById(nodeId);
            await storageManager.saveTree(tabId, tree);
            notifyTreeUpdate(tabId);
            
            sendResponse({ success: true });
          }
          break;
        }
        
        case 'GET_SETTINGS': {
          const settings = await storageManager.getSettings();
          sendResponse({ success: true, settings });
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
          const settings = await getSettings();
          
          if (settings.multiTabEnabled) {
            const tab = await chrome.tabs.get(message.tabId);
            const tree = await storageManager.getWindowTree(tab.windowId);
            tree.clear();
            await storageManager.saveWindowTree(tab.windowId, tree);
            // Also clear tab mappings for this window
            tabManager.unregisterWindow(tab.windowId);
            notifyWindowTreeUpdate(tab.windowId, tree);
          } else {
            const tree = await storageManager.getTree(message.tabId);
            tree.clear();
            await storageManager.saveTree(message.tabId, tree);
            notifyTreeUpdate(message.tabId);
          }
          sendResponse({ success: true });
          break;
        }
        
        case 'OPEN_NEW_TAB': {
          // Used by content script in multi-tab mode
          const { url, windowId } = message;
          const settings = await getSettings();
          
          if (settings.multiTabEnabled) {
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
          // Remove a node from history
          const { tabId, windowId, nodeId } = message;
          const settings = await getSettings();
          
          if (settings.multiTabEnabled) {
            const tree = await storageManager.getWindowTree(windowId);
            tree.removeNode(nodeId);
            await storageManager.saveWindowTree(windowId, tree);
            
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
            
            notifyWindowTreeUpdate(windowId, tree);
          } else {
            const tree = await storageManager.getTree(tabId);
            tree.removeNode(nodeId);
            await storageManager.saveTree(tabId, tree);
            notifyTreeUpdate(tabId);
          }
          
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
 * Also update currentNodeId when user switches tabs via browser.
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const settings = await getSettings();
  if (settings.multiTabEnabled) {
    const { tabId, windowId } = activeInfo;
    tabManager.touch(windowId, tabId);
    
    // Find the node for this tab and update currentNodeId
    const nodeId = tabManager.getNodeForTab(windowId, tabId);
    if (nodeId !== null) {
      const tree = await storageManager.getWindowTree(windowId);
      if (tree && tree.currentNodeId !== nodeId) {
        tree.currentNodeId = nodeId;
        await storageManager.saveWindowTree(windowId, tree);
        
        // Notify sidepanel
        notifyWindowTreeUpdate(windowId, tree);
      }
    }
  }
});

/**
 * Cleanup orphaned trees on service worker startup.
 */
storageManager.cleanupOrphanedTrees();

console.log('Trail service worker initialized');
