import type { FaviconUrl, NodeId, TabId, Title, Url } from '@shared/types/ids.js';
import { tabManager } from '../state/tab-manager.js';
import { treeStorage } from '../services/tree-storage.js';
import { notifyTreeUpdate } from '../messaging/notifications.js';
import { normalizeFaviconUrl, shouldTrackUrl, isNewTabContext } from '../utils/url-utils.js';
import { handleNewTabTab } from '../utils/new-tab.js';
import type { NodeData } from '@shared/types/node.js';

let syncPromise: Promise<void> | null = null;

export async function syncOpenTabs(): Promise<void> {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const tree = await treeStorage.getOrCreateTree();
    tabManager.reset();

    const tabs = await chrome.tabs.query({});
    const touched: Array<{ tabId: TabId; nodeId: NodeId; lastAccessed: number }> = [];

    const validTabs = tabs.filter((tab) => tab.id && tab.url);

    validTabs.forEach((tab) => {
      const url = tab.url as Url;
      if (isNewTabContext(url, tab.title)) {
        const result = handleNewTabTab(tree, tab, url, { touch: false, setCurrent: false });
        if (result.rootId) {
          touched.push({
            tabId: tab.id as TabId,
            nodeId: result.rootId,
            lastAccessed: tab.lastAccessed ?? 0,
          });
        }
        return;
      }
      if (!shouldTrackUrl(url)) return;

      const node = tree.findByUrl(url);
      if (!node) return;

      const tabId = tab.id as TabId;
      tabManager.register(node.id, tabId, { touch: false, lastUsed: tab.lastAccessed ?? 0 });
      touched.push({ tabId, nodeId: node.id, lastAccessed: tab.lastAccessed ?? 0 });
    });

    touched.sort((a, b) => a.lastAccessed - b.lastAccessed).forEach((entry) => {
      tabManager.touch(entry.tabId, entry.nodeId, entry.lastAccessed);
    });

    const prevCurrentId = tree.getCurrentId();
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (activeTab?.id && activeTab.url) {
      const activeUrl = activeTab.url as Url;
      if (isNewTabContext(activeUrl, activeTab.title)) {
        handleNewTabTab(tree, activeTab, activeUrl, { touch: true, setCurrent: true });
      } else if (shouldTrackUrl(activeUrl)) {
        const activeTabId = activeTab.id as TabId;
        const existingId =
          tabManager.nodeByTab(activeTabId) || tree.findByUrl(activeUrl)?.id;
        if (existingId) {
          tree.setCurrentById(existingId);
        } else {
          const data: NodeData = {
            url: activeUrl,
            title: (activeTab.title || activeUrl) as Title,
            pinned: false,
            tags: [],
          };
          const favicon = normalizeFaviconUrl(
            activeUrl,
            activeTab.favIconUrl as FaviconUrl | undefined,
          );
          if (favicon) {
            data.favicon = favicon;
          }
          const node = tree.navigate(data);
          const lastUsed = Number.isFinite(activeTab.lastAccessed)
            ? activeTab.lastAccessed
            : undefined;
          const registerOptions =
            lastUsed === undefined ? { touch: true } : { touch: true, lastUsed };
          tabManager.register(node.id, activeTabId, registerOptions);
        }
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
