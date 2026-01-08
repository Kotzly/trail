import type { FaviconUrl, TabId, Title } from '../../shared/types/ids';
import { tabManager } from '../state/tab-manager';
import { treeStorage } from '../services/tree-storage';
import { notifyTreeUpdate } from '../messaging/notifications';

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
  
  const tree = await treeStorage.getTree();
  if (!tree) return;

  const node = tree.findNodeById(nodeId);
  if (!node) return;

  if (changeInfo.title) {
    node.data.title = changeInfo.title as Title;
  }

  if (changeInfo.favIconUrl) {
    node.data.favicon = changeInfo.favIconUrl as FaviconUrl;
  }

  await notifyTreeUpdate(tree);
  await treeStorage.saveTree(tree);
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

  const tree = await treeStorage.getTree();
  if (!tree) return;
  await notifyTreeUpdate(tree);  
}
