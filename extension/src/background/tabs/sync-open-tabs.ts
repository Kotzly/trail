import type { FaviconUrl, NodeId, TabId, Title, Url } from '../../shared/types/ids.js';
import { tabManager } from '../state/tab-manager.js';
import { treeStorage } from '../services/tree-storage.js';
import { notifyTreeUpdate } from '../messaging/notifications.js';
import { isBlankUrl, normalizeFaviconUrl, shouldTrackUrl } from '../utils/url-utils.js';
import type { NodeData } from '../../shared/types/node.js';

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
      if (!shouldTrackUrl(tab.url as Url) || isBlankUrl(tab.url as Url)) continue;
      const node = tree.findByUrl(tab.url as Url);
      if (!node) continue;
      const tabId = tab.id as TabId;
      tabManager.register(node.id, tabId, { touch: false, lastUsed: tab.lastAccessed ?? 0 });
      touched.push({
        tabId,
        nodeId: node.id,
        lastAccessed: tab.lastAccessed ?? 0,
      });
    }

    touched
      .sort((a, b) => a.lastAccessed - b.lastAccessed)
      .forEach((entry) => {
        tabManager.touch(entry.tabId, entry.nodeId, entry.lastAccessed);
      });

    const prevCurrentId = tree.getCurrentId();
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (
      activeTab?.id &&
      activeTab.url &&
      shouldTrackUrl(activeTab.url as Url) &&
      !isBlankUrl(activeTab.url as Url)
    ) {
      const activeTabId = activeTab.id as TabId;
      const existingId =
        tabManager.nodeByTab(activeTabId) ?? tree.findByUrl(activeTab.url as Url)?.id ?? null;
      if (existingId) {
        tree.setCurrentById(existingId);
      } else {
        const data: NodeData = {
          url: activeTab.url as Url,
          title: (activeTab.title || activeTab.url) as Title,
          pinned: false,
          tags: [],
        };
        const favicon = normalizeFaviconUrl(activeTab.url as Url, activeTab.favIconUrl as FaviconUrl | undefined);
        if (favicon) {
          data.favicon = favicon;
        }
        const node = tree.navigate(data);
        const lastUsed = Number.isFinite(activeTab.lastAccessed) ? activeTab.lastAccessed : undefined;
        const registerOptions = lastUsed === undefined ? { touch: true } : { touch: true, lastUsed };
        tabManager.register(node.id, activeTabId, registerOptions);
      }
    }

    if (tree.getCurrentId() !== prevCurrentId) {
      treeStorage.cacheTree(tree);
    }

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
