import type { FaviconUrl, TabId, Title, Url } from '../../shared/types/ids.js';
import { tabManager } from '../state/tab-manager.js';
import { treeStorage } from '../services/tree-storage.js';
import { notifyTreeUpdate } from '../messaging/notifications.js';
import { tempSelectionManager } from '../services/temporary-selection.js';
import { enforceTabLimit } from './tab-limit.js';
import { notifyUi } from '../messaging/ui-notifications.js';

import { syncTabTitleFavicon, syncTabAudioState } from './tab-sync.js';
import { NodeData } from '../../shared/types/node.js';
import { normalizeFaviconUrl, shouldTrackUrl } from '../utils/url-utils.js';


async function onTabCreated(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) return;
  if (tabManager.isIgnoredTab(tab.id as TabId)) return;
  const nodeId = tabManager.nodeByTab(tab.id as TabId);
  if (nodeId) return;
  if (!tab.url) return;
  if (!shouldTrackUrl(tab.url as Url)) return;

  const tree = await treeStorage.getOrCreateTree();
  const existing = tree.findByUrl(tab.url as Url);
  if (!existing) return;

  const lastUsed = Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : undefined;
  const registerOptions = lastUsed === undefined ? { touch: tab.active } : { touch: tab.active, lastUsed };
  tabManager.register(existing.id, tab.id as TabId, registerOptions);
  await enforceTabLimit(tree, { activeTabId: tab.active ? (tab.id as TabId) : null });
  await notifyTreeUpdate(tree, 'tabs');
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const active = await chrome.tabs.query({ active: true, currentWindow: true });
  return active[0];
}

async function onTabRemoved(tabId_: number, _: chrome.tabs.OnRemovedInfo): Promise<void> {
  const tabId = tabId_ as TabId;

  const tree = await treeStorage.getOrCreateTree();
  const activeTab = await getActiveTab();
  if (!activeTab?.url || !shouldTrackUrl(activeTab.url as Url)) {
    tree.clearCurrent();
  } else {
    const activeNodeId = tabManager.nodeByTab(activeTab.id as TabId);
    if (activeNodeId) tree.setCurrentById(activeNodeId);
  }
  tabManager.unregister(tabId);

  await notifyTreeUpdate(tree, 'tabs');
  treeStorage.cacheTree(tree);
}

async function onTabActivated(activeInfo: chrome.tabs.OnActivatedInfo): Promise<void> {
    const tabId = activeInfo.tabId as TabId;
    if (tabManager.isIgnoredTab(tabId)) return;

    let nodeId = tabManager.nodeByTab(tabId);
    const tree = await treeStorage.getOrCreateTree();

    let evicted = 0;
    if (nodeId === undefined) {
        try {
            const tab = await chrome.tabs.get(tabId);
            if (!tab.url) return;
            if (!shouldTrackUrl(tab.url as Url)) return;

            const existing = tree.findByUrl(tab.url as Url);
            if (existing) {
                tabManager.register(existing.id, tabId);
                nodeId = existing.id;
            } else {
                const data: NodeData = {
                    url: tab.url as Url,
                    title: (tab.title || tab.url) as Title,
                    favicon: normalizeFaviconUrl(tab.url as Url, tab.favIconUrl as FaviconUrl | undefined),
                    pinned: false,
                    tags: [],
                } as NodeData;
                const node = tree.navigate(data);
                tabManager.register(node.id, tabId);
                nodeId = node.id;
            }
        } catch (e) {
            return;
        }
    }

    if (nodeId === undefined) return;
    if (tabManager.shouldSuppressActivate(tabId)) {
        return;
    }
    tempSelectionManager.handleTabActivated(tabId);
    if (!tabManager.shouldSuppressTouch(tabId)) {
        tabManager.touch(tabId, nodeId);
    }
    evicted = tree.consumeEvictedCount();
    const prevCurrentId = tree.getCurrentId();
    tree.setCurrentById(nodeId);
    treeStorage.cacheTree(tree);
    if (evicted > 0) {
      notifyUi({
        message: `Evicted ${evicted} node${evicted === 1 ? '' : 's'} due to capacity`,
        icon: 'AlertTriangle',
        durationMs: 5000,
      });
    }
    if (prevCurrentId !== nodeId) {
      await notifyTreeUpdate(tree, 'set-current', { focusNodeId: nodeId, mode: 'force' });
    } else {
      await notifyTreeUpdate(tree, 'tabs');
    }
    await enforceTabLimit(tree, { activeTabId: tabId });
}

async function onTabUpdated(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab): Promise<void> {
    if (tabManager.isIgnoredTab(tabId as TabId)) return;
    if (changeInfo.audible || changeInfo.mutedInfo) {
        await syncTabAudioState(tabId as TabId, changeInfo, tab);
        return;
    }

    if (changeInfo.title || changeInfo.favIconUrl) {
        await syncTabTitleFavicon(tabId as TabId, changeInfo, tab);
        return;
    }
}


export function initTabsLifecycle(): void {
    chrome.tabs.onCreated.addListener(onTabCreated);
    chrome.tabs.onRemoved.addListener(onTabRemoved);
    chrome.tabs.onActivated.addListener(onTabActivated);
    chrome.tabs.onUpdated.addListener(onTabUpdated);
}
