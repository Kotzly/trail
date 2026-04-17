import type { TabId, Url } from "@shared/types/ids.js";
import { tabManager } from "../state/tab-manager.js";
import { treeStorage, withTreeLock } from "../services/tree-storage.js";
import { notifyTreeUpdate } from "../messaging/notifications.js";
import { tempSelectionManager } from "../services/temporary-selection.js";

import { syncTabTitleFavicon, syncTabAudioState } from "./tab-sync.js";
import { shouldTrackUrl, isNewTabContext } from "../utils/url-utils.js";
import { handleNewTabTab } from "../utils/new-tab.js";
import { browser, type Browser, type Tab } from "@shared/platform/webext.js";
import { markNodeVisited } from "../state/node-recency.js";
import { createLogger } from "@shared/lib/logger.js";
import { getEditorState, saveEditorMode } from "../messaging/handlers/editor-handlers.js";
import type { TreeViewIntent, TreeUpdateReason } from "@shared/rpc/contracts.js";

const log = createLogger("tab-lifecycle");

type LifecycleBroadcast =
  | { kind: "none" }
  | { kind: "notify"; reason: TreeUpdateReason; view?: TreeViewIntent };

async function onTabCreated(tab: Tab): Promise<void> {
  if (!tab.id) return;
  if (tabManager.isIgnoredTab(tab.id as TabId)) return;
  if (!tab.url) return;
  const url = tab.url as Url;

  const broadcast = await withTreeLock(async () => {
    // Re-check inside the lock — another handler may have registered
    // this tab between our entry check and here.
    if (tabManager.nodeByTab(tab.id as TabId)) return { kind: "none" } as LifecycleBroadcast;

    const tree = await treeStorage.getOrCreateTree();
    if (isNewTabContext(url, tab.title)) {
      const result = handleNewTabTab(tree, tab, url, { touch: tab.active, setCurrent: false });
      if (result.didMutate || result.didUpdateCurrent) {
        treeStorage.cacheTree(tree);
      }
      return { kind: "notify", reason: "tabs" } as LifecycleBroadcast;
    }
    if (!shouldTrackUrl(url)) return { kind: "none" } as LifecycleBroadcast;

    const existing = tree.findByUrl(url);
    if (!existing) return { kind: "none" } as LifecycleBroadcast;

    const lastUsed = Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : undefined;
    const registerOptions =
      lastUsed === undefined ? { touch: tab.active } : { touch: tab.active, lastUsed };
    tabManager.register(existing.id, tab.id as TabId, registerOptions);
    return { kind: "notify", reason: "tabs" } as LifecycleBroadcast;
  });

  if (broadcast.kind === "notify") {
    const tree = await treeStorage.getOrCreateTree();
    await notifyTreeUpdate(tree, broadcast.reason, broadcast.view);
  }
}

export async function getActiveTab(): Promise<Tab | undefined> {
  const active = await browser.tabs.query({ active: true, currentWindow: true });
  return active[0];
}

async function onTabRemoved(tabId_: number, _: Browser.tabs.OnRemovedInfo): Promise<void> {
  const tabId = tabId_ as TabId;

  // Active-tab query runs outside the lock.
  const activeTab = await getActiveTab();

  const broadcast = await withTreeLock(async () => {
    const tree = await treeStorage.getOrCreateTree();
    if (!activeTab?.url || !shouldTrackUrl(activeTab.url as Url)) {
      tree.clearCurrent();
    } else {
      const activeNodeId = tabManager.nodeByTab(activeTab.id as TabId);
      if (activeNodeId) tree.setCurrentById(activeNodeId);
    }
    tabManager.unregister(tabId);
    treeStorage.cacheTree(tree);
    return { kind: "notify", reason: "tabs" } as LifecycleBroadcast;
  });

  if (broadcast.kind === "notify") {
    const tree = await treeStorage.getOrCreateTree();
    await notifyTreeUpdate(tree, broadcast.reason, broadcast.view);
  }
}

async function onTabActivated(activeInfo: Browser.tabs.OnActivatedInfo): Promise<void> {
  const tabId = activeInfo.tabId as TabId;
  if (tabManager.isIgnoredTab(tabId)) return;
  if (tabManager.shouldSuppressActivate(tabId)) return;

  // Auto-exit editor mode when switching tabs (has its own locking)
  const editorState = getEditorState();
  if (editorState.active) {
    try {
      await saveEditorMode();
    } catch (e) {
      log.warn("Auto-exit editor on tab switch failed", { error: String(e) });
    }
  }

  // Read the tab (and potentially do a URL-track check) outside the
  // lock so a slow tabs.get doesn't stall the whole browser.
  let tabRead: Tab | undefined;
  if (tabManager.nodeByTab(tabId) === undefined) {
    try {
      tabRead = await browser.tabs.get(tabId);
    } catch {
      return;
    }
  }

  const broadcast = await withTreeLock(async () => {
    let nodeId = tabManager.nodeByTab(tabId);
    const tree = await treeStorage.getOrCreateTree();

    if (nodeId === undefined) {
      if (!tabRead) return { kind: "none" } as LifecycleBroadcast;
      if (!tabRead.url) return { kind: "none" } as LifecycleBroadcast;
      const url = tabRead.url as Url;
      if (isNewTabContext(url, tabRead.title)) {
        const result = handleNewTabTab(tree, tabRead, url, {
          touch: false,
          setCurrent: false,
        });
        nodeId = result.rootId ?? undefined;
      } else {
        if (!shouldTrackUrl(url)) return { kind: "none" } as LifecycleBroadcast;

        // Only register against an existing node match. Do NOT
        // fabricate a new node here — that was bug #93: activating
        // a pre-existing untracked tab silently created it as a
        // child of `tree.current`, producing false parent edges on
        // every installed-before-extension tab. If no node exists
        // yet, we skip; a real webnav event will trigger node
        // creation with proper opener-derived parent later.
        const existing = tree.findByUrl(url);
        if (!existing) return { kind: "none" } as LifecycleBroadcast;
        tabManager.register(existing.id, tabId);
        nodeId = existing.id;
      }
    }

    if (nodeId === undefined) return { kind: "none" } as LifecycleBroadcast;
    tempSelectionManager.handleTabActivated(tabId);
    if (!tabManager.shouldSuppressTouch(tabId)) {
      tabManager.touch(tabId, nodeId);
      markNodeVisited(tree, nodeId);
    }
    const prevCurrentId = tree.getCurrentId();
    tree.setCurrentById(nodeId);
    treeStorage.cacheTree(tree);
    if (prevCurrentId !== nodeId) {
      return {
        kind: "notify",
        reason: "set-current",
        view: { focusNodeId: nodeId, mode: "force" },
      } as LifecycleBroadcast;
    }
    return { kind: "notify", reason: "tabs" } as LifecycleBroadcast;
  });

  if (broadcast.kind === "notify") {
    const tree = await treeStorage.getOrCreateTree();
    await notifyTreeUpdate(tree, broadcast.reason, broadcast.view);
  }
}

async function onWindowFocusChanged(windowId: number): Promise<void> {
  if (windowId === browser.windows.WINDOW_ID_NONE) return;

  // Filter out non-normal windows (devtools pop-outs, picture-in-
  // picture hosts, macOS workspace transitions). Focusing these
  // shouldn't trigger a tree current-repoint.
  try {
    const win = await browser.windows.get(windowId);
    if (win.type !== "normal") return;
  } catch {
    return;
  }

  const [activeTab] = await browser.tabs.query({ active: true, windowId });
  if (!activeTab?.id) return;

  const tabId = activeTab.id as TabId;
  if (tabManager.isIgnoredTab(tabId)) return;

  // Short-circuit if the active tab is unchanged since the last
  // focus event — saves a round of cacheTree + notify. Covered
  // by the overall isReady + lock discipline elsewhere.
  if (tabManager.nodeByTab(tabId) === lastFocusedActiveTabId) return;
  lastFocusedActiveTabId = tabManager.nodeByTab(tabId);

  await onTabActivated({ tabId: activeTab.id, windowId });
}

let lastFocusedActiveTabId: ReturnType<typeof tabManager.nodeByTab> = undefined;

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
