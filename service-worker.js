import { storageManager } from './lib/storage-manager.js';

/**
 * Service Worker for Stack History extension.
 * Handles navigation tracking, tab lifecycle, and messaging.
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
 * @param {object} details - Navigation details from webNavigation API
 * @param {string} [transitionType] - Type of navigation transition
 */
async function handleNavigation(details, transitionType) {
  const { tabId, url, frameId } = details;

  // Only track main frame navigations
  if (frameId !== 0) return;

  // Skip ignored URLs
  if (!shouldTrackUrl(url)) return;

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
 * Notify side panel that a tree has been updated.
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
    const tree = await storageManager.getTree(tabId);
    const currentNode = tree.currentNode;

    // Update title if it changed
    if (currentNode && currentNode.url === url && tab.title && tab.title !== currentNode.title) {
      currentNode.title = tab.title;
      currentNode.favicon = tab.favIconUrl || currentNode.favicon;
      await storageManager.saveTree(tabId, tree);
      notifyTreeUpdate(tabId);
    }
  } catch (error) {
    console.debug('onCompleted error:', error);
  }
});

/**
 * Cleanup tree when tab is closed.
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  storageManager.removeTree(tabId);
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
          
          try {
            const tree = await storageManager.getTree(tabId);
            const currentNode = tree.currentNode;
            
            // Update title if current node matches URL and title changed
            if (currentNode && currentNode.url === url && currentNode.title !== newTitle) {
              currentNode.title = newTitle;
              await storageManager.saveTree(tabId, tree);
              notifyTreeUpdate(tabId);
            }
          } catch (error) {
            console.debug('Title update error:', error);
          }
          break;
        }
        
        case 'GET_TREE': {
          const tree = await storageManager.getTree(message.tabId);
          sendResponse({ success: true, tree: tree.toJSON() });
          break;
        }
        
        case 'GET_CURRENT_TAB': {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          sendResponse({ success: true, tab });
          break;
        }
        
        case 'NAVIGATE_TO': {
          const { tabId, url, nodeId } = message;
          
          // Mark this navigation so we don't add duplicate to tree
          sidebarNavigations.set(`${tabId}:${url}`, nodeId);
          
          // Clear after timeout in case navigation fails
          setTimeout(() => {
            sidebarNavigations.delete(`${tabId}:${url}`);
          }, 5000);
          
          const tree = await storageManager.getTree(tabId);
          const currentNode = tree.currentNode;
          
          let navigated = false;
          
          // Try fast navigation for same-origin
          if (currentNode) {
            try {
              const currentUrl = new URL(currentNode.url);
              const targetUrl = new URL(url);
              
              if (currentUrl.origin === targetUrl.origin) {
                // For hash-only navigation (like Gmail) - just change location
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
          
          // Fallback to regular navigation
          if (!navigated) {
            await chrome.tabs.update(tabId, { url });
          }
          
          // Update current node
          tree.setCurrentById(nodeId);
          await storageManager.saveTree(tabId, tree);
          notifyTreeUpdate(tabId);
          
          sendResponse({ success: true });
          break;
        }
        
        case 'GET_SETTINGS': {
          const settings = await storageManager.getSettings();
          sendResponse({ success: true, settings });
          break;
        }
        
        case 'SAVE_SETTINGS': {
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
          const tree = await storageManager.getTree(message.tabId);
          tree.clear();
          await storageManager.saveTree(message.tabId, tree);
          notifyTreeUpdate(message.tabId);
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
 * Cleanup orphaned trees on service worker startup.
 */
storageManager.cleanupOrphanedTrees();

console.log('Stack History service worker initialized');
