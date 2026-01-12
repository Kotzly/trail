import type { NodeId, TabId, Url } from '../../shared/types/ids.js';
import { tabManager } from '../state/tab-manager.js';
import { treeStorage } from '../services/tree-storage.js';
import { notifyTreeUpdate } from '../messaging/notifications.js';
import { shouldTrackUrl } from '../utils/url-utils.js';

let syncPromise: Promise<void> | null = null;

export async function syncOpenTabs(): Promise<void> {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const tree = await treeStorage.getOrCreateTree();
    tabManager.reset();

    const tabs = await chrome.tabs.query({});
    const touched: Array<{ tabId: TabId; nodeId: NodeId; lastAccessed: number }> = [];

    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      if (!shouldTrackUrl(tab.url as Url)) continue;
      const node = tree.findByUrl(tab.url as Url);
      if (!node) continue;
      const tabId = tab.id as TabId;
      tabManager.register(node.id, tabId);
      touched.push({
        tabId,
        nodeId: node.id,
        lastAccessed: tab.lastAccessed ?? 0,
      });
    }

    touched
      .sort((a, b) => a.lastAccessed - b.lastAccessed)
      .forEach((entry) => {
        tabManager.touch(entry.tabId, entry.nodeId);
      });

    await notifyTreeUpdate(tree, 'tabs');
  })()
    .catch((error) => {
      console.error('Failed to sync open tabs:', error);
    })
    .finally(() => {
      syncPromise = null;
    });

  return syncPromise;
}
