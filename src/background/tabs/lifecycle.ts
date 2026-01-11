import type { TabId, Title, Url } from '../../shared/types/ids.js';
import { tabManager } from '../state/tab-manager.js';
import { treeStorage } from '../services/tree-storage.js';
import { notifyTreeUpdate } from '../messaging/notifications.js';

import { syncTabTitleFavicon, syncTabAudioState } from './tab-sync.js';
import { NodeData } from '../../shared/types/node.js';
import { normalizeFaviconUrl, shouldTrackUrl } from '../utils/url-utils.js';


async function onTabCreated(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) return;
  const nodeId = tabManager.nodeByTab(tab.id as TabId);
  if (nodeId) return;
  if (!tab.url || !shouldTrackUrl(tab.url as Url)) return;

  const tree = await treeStorage.getOrCreateTree();
  const existing = tree.findByUrl(tab.url as Url);
  if (!existing) return;

  tabManager.register(existing.id, tab.id as TabId);
  await notifyTreeUpdate(tree);
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const active = await chrome.tabs.query({ active: true, currentWindow: true });
  return active[0];
}

async function onTabRemoved(tabId_: number, _: chrome.tabs.OnRemovedInfo): Promise<void> {
  const tabId = tabId_ as TabId;

  const tree = await treeStorage.getOrCreateTree();
  const activeTab = await getActiveTab();
  if (!activeTab || !shouldTrackUrl(activeTab.url as Url)) {
    tree.clearCurrent();
  } else {
    const activeNodeId = tabManager.nodeByTab(activeTab.id as TabId);
    if (activeNodeId) tree.setCurrentById(activeNodeId);
  }
  tabManager.unregister(tabId);

  await notifyTreeUpdate(tree);
  treeStorage.cacheTree(tree);
}

async function onTabActivated(activeInfo: chrome.tabs.OnActivatedInfo): Promise<void> {
    const tabId = activeInfo.tabId as TabId;

    let nodeId = tabManager.nodeByTab(tabId);
    const tree = await treeStorage.getOrCreateTree();

    if (nodeId === undefined) {
        try {
            const tab = await chrome.tabs.get(tabId);
            if (!tab.url || !shouldTrackUrl(tab.url as Url)) return;

            const existing = tree.findByUrl(tab.url as Url);
            if (existing) {
                tabManager.register(existing.id, tabId);
                nodeId = existing.id;
            } else {
                const data: NodeData = {
                    url: tab.url as Url,
                    title: (tab.title || tab.url) as Title,
                    favicon: normalizeFaviconUrl(tab.url as Url, tab.favIconUrl),
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
    if (!tabManager.shouldSuppressTouch(tabId)) {
        tabManager.touch(tabId, nodeId);
    }
    tree.setCurrentById(nodeId);
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree);
}

async function onTabUpdated(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab): Promise<void> {
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
