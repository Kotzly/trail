import type { FaviconUrl, TabId, Title, Url } from '../../shared/types/ids.js';
import { tabManager } from '../state/tab-manager.js';
import { treeStorage } from '../services/tree-storage.js';
import { notifyTreeUpdate } from '../messaging/notifications.js';
import { normalizeFaviconUrl, shouldTrackUrl } from '../utils/url-utils.js';
import { resolveTabUrl } from '../utils/tab-utils.js';
import { createUrlKey } from '../../shared/lib/url-key.js';

/**
 * Sync tab title and favicon changes to node.
 */
export async function syncTabTitleFavicon(
  tabId: TabId,
  changeInfo: chrome.tabs.OnUpdatedInfo,
  tab: chrome.tabs.Tab
): Promise<void> {
  if (!changeInfo.title && !changeInfo.favIconUrl) return;

  const nodeId = tabManager.nodeByTab(tabId);
  if (!nodeId) return;

  const tree = await treeStorage.getOrCreateTree();

  const node = tree.findNodeById(nodeId);
  if (!node) return;

  const tabUrl = resolveTabUrl(tab);
  if (!tabUrl || !shouldTrackUrl(tabUrl as Url)) return;
  if (createUrlKey(node.data.url) !== createUrlKey(tabUrl)) return;

  if (changeInfo.title) {
    node.data.title = changeInfo.title as Title;
    tree.refreshSearchEntry(nodeId);
  }

  if (changeInfo.favIconUrl) {
    const normalized = normalizeFaviconUrl(tabUrl as Url, changeInfo.favIconUrl as FaviconUrl | undefined);
    if (normalized !== undefined) {
      node.data.favicon = normalized;
    }
  }

  treeStorage.cacheTree(tree);
  await notifyTreeUpdate(tree, 'tabs');
}


/**
 * Sync tab audio state changes (muted, audible).
 * Notifies sidepanels to update tab states.
 */
export async function syncTabAudioState(
  tabId: TabId,
  changeInfo: chrome.tabs.OnUpdatedInfo,
  tab: chrome.tabs.Tab
): Promise<void> {
  if (!changeInfo.audible && !changeInfo.mutedInfo) return;
  const nodeId = tabManager.nodeByTab(tabId);
  if (!nodeId) return;

  const tree = await treeStorage.getOrCreateTree();
  if (!tree) return;
  await notifyTreeUpdate(tree, 'tabs');  
}
