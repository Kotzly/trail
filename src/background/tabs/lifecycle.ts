import type { TabId, Title, Url } from '../../shared/types/ids';
import { tabManager } from '../state/tab-manager';
import { treeStorage } from '../services/tree-storage';

import { syncTabTitleFavicon, syncTabAudioState } from './tab-sync';
import { NodeData } from '../../shared/types/node';


async function onTabCreated(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) return;
  const nodeId = tabManager.nodeByTab(tab.id as TabId);
  if (nodeId) return;
  if (tab?.active === undefined) return;

  const tree = await treeStorage.getTree();

  const data: NodeData = {
    url: tab.url as Url,
    title: tab.title as Title,
    pinned: false,
    tags: [],
    collapsed: false,
  }

  const node = tree.navigate(data);
  if (!node) return;

  tabManager.register(node.id, tab.id as TabId);
  await notifyTreeUpdate(tree);
  await treeStorage.saveTree(tree);

}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const active = await chrome.tabs.query({ active: true, currentWindow: true });
  return active[0];
}

async function onTabRemoved(tabId_: number, _: chrome.tabs.OnRemovedInfo): Promise<void> {
  const tabId = tabId_ as TabId;

  const tree = await treeStorage.getTree();
  const activeTab = await getActiveTab();
  if (!activeTab) return;

  const activeNodeId = tabManager.nodeByTab(activeTab.id as TabId);
  if (!activeNodeId) return;

  tree.setCurrentById(activeNodeId);

  const prevNodeId = tabManager.nodeByTab(tabId);
  if (prevNodeId) {
    const node = tree.findNodeById(prevNodeId);
    if (node) {
      node.data.collapsed = true;
    }
  }

  tabManager.unregister(tabId);
  await notifyTreeUpdate(tree);
  await treeStorage.saveTree(tree);
}

async function onTabActivated(activeInfo: chrome.tabs.OnActivatedInfo): Promise<void> {
    const tabId = activeInfo.tabId as TabId;

    const nodeId = tabManager.nodeByTab(tabId);
    if (nodeId === undefined) {
        console.warn("onTabActivated: nodeId is undefined");
        return;
    }

    const tree = await treeStorage.getTree();

    tree.setCurrentById(nodeId);
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
