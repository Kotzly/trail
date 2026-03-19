import type { FaviconUrl, TabId, Title, Url } from "@shared/types/ids.js";
import { tabManager } from "../state/tab-manager.js";
import { treeStorage } from "../services/tree-storage.js";
import { notifyTreeUpdate } from "../messaging/notifications.js";
import { tempSelectionManager } from "../services/temporary-selection.js";

import { syncTabTitleFavicon, syncTabAudioState } from "./tab-sync.js";
import { type NodeData } from "@shared/types/node.js";
import { normalizeFaviconUrl, shouldTrackUrl, isNewTabContext } from "../utils/url-utils.js";
import { handleNewTabTab } from "../utils/new-tab.js";
import { browser, type Browser, type Tab } from "@shared/platform/webext.js";
import { markNodeVisited } from "../state/node-recency.js";

async function onTabCreated(tab: Tab): Promise<void> {
  if (!tab.id) return;
  if (tabManager.isIgnoredTab(tab.id as TabId)) return;
  const nodeId = tabManager.nodeByTab(tab.id as TabId);
  if (nodeId) return;
  if (!tab.url) return;

  const tree = await treeStorage.getOrCreateTree();
  const url = tab.url as Url;
  if (isNewTabContext(url, tab.title)) {
    const result = handleNewTabTab(tree, tab, url, { touch: tab.active, setCurrent: false });
    if (result.didMutate || result.didUpdateCurrent) {
      treeStorage.cacheTree(tree);
    }
    await notifyTreeUpdate(tree, "tabs");
    return;
  }
  if (!shouldTrackUrl(url)) return;

  const existing = tree.findByUrl(url);
  if (!existing) return;

  const lastUsed = Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : undefined;
  const registerOptions =
    lastUsed === undefined ? { touch: tab.active } : { touch: tab.active, lastUsed };
  tabManager.register(existing.id, tab.id as TabId, registerOptions);
  await notifyTreeUpdate(tree, "tabs");
}

export async function getActiveTab(): Promise<Tab | undefined> {
  const active = await browser.tabs.query({ active: true, currentWindow: true });
  return active[0];
}

async function onTabRemoved(tabId_: number, _: Browser.tabs.OnRemovedInfo): Promise<void> {
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

  await notifyTreeUpdate(tree, "tabs");
  treeStorage.cacheTree(tree);
}

async function onTabActivated(activeInfo: Browser.tabs.OnActivatedInfo): Promise<void> {
  const tabId = activeInfo.tabId as TabId;
  if (tabManager.isIgnoredTab(tabId)) return;

  let nodeId = tabManager.nodeByTab(tabId);
  const tree = await treeStorage.getOrCreateTree();

  if (nodeId === undefined) {
    try {
      const tab = await browser.tabs.get(tabId);
      if (!tab.url) return;
      const url = tab.url as Url;
      if (isNewTabContext(url, tab.title)) {
        const result = handleNewTabTab(tree, tab, url, { touch: false, setCurrent: false });
        nodeId = result.rootId ?? undefined;
      } else {
        if (!shouldTrackUrl(url)) return;

        const existing = tree.findByUrl(url);
        if (existing) {
          tabManager.register(existing.id, tabId);
          nodeId = existing.id;
        } else {
          const data: NodeData = {
            url,
            title: (tab.title || url) as Title,
            favicon: normalizeFaviconUrl(url, tab.favIconUrl as FaviconUrl | undefined),
            pinned: false,
            tags: [],
          } as NodeData;
          const node = tree.navigate(data);
          tabManager.register(node.id, tabId);
          nodeId = node.id;
        }
      }
    } catch (e) {
      console.warn("[tab-lifecycle] Tab registration failed:", { tabId, error: String(e) });
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
    markNodeVisited(tree, nodeId);
  }
  const prevCurrentId = tree.getCurrentId();
  tree.setCurrentById(nodeId);
  treeStorage.cacheTree(tree);
  if (prevCurrentId !== nodeId) {
    await notifyTreeUpdate(tree, "set-current", { focusNodeId: nodeId, mode: "force" });
  } else {
    await notifyTreeUpdate(tree, "tabs");
  }
}

async function onWindowFocusChanged(windowId: number): Promise<void> {
  if (windowId === browser.windows.WINDOW_ID_NONE) return;

  const [activeTab] = await browser.tabs.query({ active: true, windowId });
  if (!activeTab?.id) return;

  const tabId = activeTab.id as TabId;
  if (tabManager.isIgnoredTab(tabId)) return;

  await onTabActivated({ tabId: activeTab.id, windowId });
}

async function onTabUpdated(
  tabId: number,
  changeInfo: Browser.tabs.OnUpdatedInfo,
  tab: Tab,
): Promise<void> {
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
  browser.tabs.onCreated.addListener(onTabCreated);
  browser.tabs.onRemoved.addListener(onTabRemoved);
  browser.tabs.onActivated.addListener(onTabActivated);
  browser.tabs.onUpdated.addListener(onTabUpdated);
  browser.windows.onFocusChanged.addListener(onWindowFocusChanged);
}
