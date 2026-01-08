import { handleNavigation } from './navigation-handler';
import { treeStorage } from '../services/tree-storage';
import { tabManager } from '../state/tab-manager';
import { shouldTrackUrl } from '../utils/url-utils';
import { notifyGlobalTreeUpdate } from '../messaging/notifications';

/**
 * Initialize webNavigation event listeners.
 */
export function initWebNavigation(): void {
  /**
   * Track page navigations (link clicks, form submissions, etc.)
   */
  chrome.webNavigation.onCommitted.addListener(async (details) => {
    const { transitionType } = details;
    
    // Track link clicks, typed URLs, form submissions, and reloads
    const trackableTransitions = ['link', 'typed', 'form_submit', 'generated', 'auto_bookmark'];
    
    if (trackableTransitions.includes(transitionType)) {
      await handleNavigation(details, transitionType);
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
    if (!shouldTrackUrl(url as any)) return;

    try {
      const tab = await chrome.tabs.get(tabId);
      
      // Always multi-tab mode: use global tree
      const nodeId = tabManager.nodeByTab(tabId as any);
      if (nodeId !== undefined) {
        const tree = await treeStorage.getGlobalTree();
        const node = tree.findNodeByIdDFS(nodeId);
        // CRITICAL: Only update if URL matches to prevent race conditions
        if (node && node.url === url && tab.title && tab.title !== node.title) {
          node.title = tab.title as any;
          node.favicon = (tab.favIconUrl || node.favicon) as any;
          await treeStorage.saveGlobalTree(tree);
          await notifyGlobalTreeUpdate(tree);
        }
      }
    } catch (error) {
      console.debug('onCompleted error:', error);
    }
  });

  /**
   * Handle tab replacement (e.g., prerendering).
   */
  chrome.webNavigation.onTabReplaced.addListener(async (details) => {
    const { replacedTabId, tabId } = details;
    
    // Move tree from old tab to new tab
    try {
      const oldTree = await treeStorage.getTree(replacedTabId as any);
      await treeStorage.saveTree(tabId as any, oldTree);
      await treeStorage.removeTree(replacedTabId as any);
    } catch (error) {
      console.debug('Tab replacement error:', error);
    }
  });
}
