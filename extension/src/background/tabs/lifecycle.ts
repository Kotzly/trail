import type { NodeId, TabId, Url } from "@shared/types/ids.js";
import { tabManager } from "../state/tab-manager.js";
import { treeStorage, withTreeLock } from "../services/tree-storage.js";
import { notifyTreeUpdate } from "../messaging/notifications.js";
import { tempSelectionManager } from "../services/temporary-selection.js";

import { syncTabTitleFavicon, syncTabAudioState } from "./tab-sync.js";
import { shouldTrackUrl, isNewTabContext, isOwnExtensionUrl } from "../utils/url-utils.js";
import { handleNewTabTab } from "../utils/new-tab.js";
import { browser, type Browser, type Tab } from "@shared/platform/webext.js";
import { markNodeVisited } from "../state/node-recency.js";
import { createLogger } from "@shared/lib/logger.js";
import { getEditorState, saveEditorMode } from "../messaging/handlers/editor-handlers.js";
import { settingsManager } from "../services/settings.js";
import {
  onTabFinished as trackerOnTabFinished,
  onTabRemoved as trackerOnTabRemoved,
  onTabBlur as trackerOnTabBlur,
  onTabFocus as trackerOnTabFocus,
} from "../navigation/nav-pattern-tracker.js";
import { pruneGlance } from "../services/cleanup-policy.js";
import type { TreeViewIntent, TreeUpdateReason } from "@shared/rpc/contracts.js";

const log = createLogger("tab-lifecycle");

/**
 * True when the tab is incognito AND the user asked us to skip
 * incognito browsing. Centralized so every lifecycle handler applies
 * the same gate (fixes #30 — the navigation-handler already had it,
 * but onTabCreated / onTabRemoved / onTabActivated / onTabUpdated /
 * onWindowFocusChanged didn't, leaking incognito state into the
 * public tree).
 */
function skipIncognito(tab: Tab | { incognito?: boolean } | undefined): boolean {
  if (!tab?.incognito) return false;
  return settingsManager.get().privacy.skipIncognito;
}

type LifecycleBroadcast =
  | { kind: "none" }
  | { kind: "notify"; reason: TreeUpdateReason; view?: TreeViewIntent };

/**
 * The most recent node we promoted to `tree.current` via tab
 * activation. Unlike `tree.current` itself this value is NOT cleared
 * when we detach the highlight (e.g. user activates an untrackable
 * tab → current becomes null but we still remember "what they were
 * looking at"). Read by `handleNavigation` to parent newly-created
 * nodes under the user's previous focused page when no opener / last-
 * known mapping is available — the canonical "I clicked Settings
 * from sidepanel; it should slot under the page I was on" semantic.
 */
let lastFocusedTrackedNodeId: NodeId | null = null;
export function getLastFocusedTrackedNodeId(): NodeId | null {
  return lastFocusedTrackedNodeId;
}

async function onTabCreated(tab: Tab): Promise<void> {
  const pendingUrl = (tab as Tab & { pendingUrl?: string }).pendingUrl;
  if (!tab.id) return;
  if (tabManager.isIgnoredTab(tab.id as TabId)) return;
  if (skipIncognito(tab)) return;
  // Use pendingUrl as a backstop when Chrome reports tab.url="" during
  // the brief window between tabs.create() and first commit. Without
  // this, an explicit `tabs.create({ url: 'about:blank' })`-style
  // race would slip past `if (!tab.url) return` even when pendingUrl
  // reveals the real (untrackable) destination, and we'd end up with
  // a stale tab→NTP mapping (root cause of the "settings = current
  // newtab" bug).
  const effectiveUrl = (tab.url && tab.url.length > 0 ? tab.url : pendingUrl) as Url | undefined;
  if (!effectiveUrl) return;
  const url = effectiveUrl;

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

    // Our own extension pages (settings, sidepanel, …) must never be
    // de-duped against an existing node: each "open Settings" click
    // is a fresh side-trip from a different page in the user's flow,
    // and reusing the prior node would yank current away to whatever
    // branch the old settings node lived under. Let webnav create a
    // brand-new node parented under the user's current page.
    if (isOwnExtensionUrl(url)) return { kind: "none" } as LifecycleBroadcast;

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

async function onTabRemoved(tabId_: number, removeInfo: Browser.tabs.OnRemovedInfo): Promise<void> {
  const tabId = tabId_ as TabId;

  // Query the active tab in the window the removal happened in, NOT
  // the currently-focused window. Fixes #65 — closing a tab in a
  // background window was yanking tree.current to the foreground
  // window's active tab (a completely unrelated page) because the
  // old query used { active: true, currentWindow: true }.
  let activeTab: Tab | undefined;
  try {
    if (removeInfo.windowId !== undefined) {
      const [tab] = await browser.tabs.query({
        active: true,
        windowId: removeInfo.windowId,
      });
      activeTab = tab;
    }
  } catch {
    // Window closed (isWindowClosing path) — nothing to focus.
  }
  if (!activeTab) {
    // Fallback: use any currently-focused window's active tab.
    activeTab = await getActiveTab();
  }

  const broadcast = await withTreeLock(async () => {
    const tree = await treeStorage.getOrCreateTree();
    if (!activeTab?.url || !shouldTrackUrl(activeTab.url as Url)) {
      tree.clearCurrent();
    } else {
      const activeNodeId = tabManager.nodeByTab(activeTab.id as TabId);
      if (activeNodeId) tree.setCurrentById(activeNodeId);
    }
    tabManager.unregister(tabId);
    // Ordering matters: cache BEFORE broadcast so the sidepanel
    // picks up the post-unregister state (fixes #66 — notify-then-
    // cache let concurrent handlers observe old state).
    treeStorage.cacheTree(tree);
    return { kind: "notify", reason: "tabs" } as LifecycleBroadcast;
  });

  // Layer 3a: retroactively classify the final dwell on this tab.
  // If the user had the tab open briefly and closed without
  // returning, the node is a glance candidate.
  try {
    const cls = trackerOnTabFinished(tabId, Date.now());
    if (cls.kind === "glance") {
      await pruneGlance(cls.nodeId);
    }
  } catch (error) {
    log.warn("Pattern tracker onTabFinished failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  trackerOnTabRemoved(tabId);

  if (broadcast.kind === "notify") {
    const tree = await treeStorage.getOrCreateTree();
    await notifyTreeUpdate(tree, broadcast.reason, broadcast.view);
  }
}

async function onTabActivated(activeInfo: Browser.tabs.OnActivatedInfo): Promise<void> {
  const tabId = activeInfo.tabId as TabId;
  if (tabManager.isIgnoredTab(tabId)) return;
  if (tabManager.shouldSuppressActivate(tabId)) return;

  // Single tab read — used for both incognito gate and the URL
  // trackability check below. Outside the lock so a slow tabs.get
  // doesn't stall the whole browser.
  let tabRead: Tab | undefined;
  try {
    tabRead = await browser.tabs.get(tabId);
  } catch {
    // Tab vanished — nothing to do.
    return;
  }
  if (skipIncognito(tabRead)) return;

  // Auto-exit editor mode when switching tabs (has its own locking)
  const editorState = getEditorState();
  if (editorState.active) {
    try {
      await saveEditorMode();
    } catch (e) {
      log.warn("Auto-exit editor on tab switch failed", { error: String(e) });
    }
  }

  const broadcast = await withTreeLock(async () => {
    let nodeId = tabManager.nodeByTab(tabId);
    const tree = await treeStorage.getOrCreateTree();

    // Two distinct outcomes when we can't promote a node to current:
    //  - detach(): user is on a KNOWN-untrackable URL (chrome://, our
    //    own settings without opt-in, etc.). Drop the highlight so the
    //    sidepanel shows nothing — the user is no longer in a tracked
    //    context. `lastFocusedTrackedNodeId` is intentionally NOT
    //    cleared, so handleNavigation can still parent newly-created
    //    nodes under the user's prior page.
    //  - noop(): URL is unknown yet (pending), or trackable but we
    //    haven't matched a node yet — webnav will resolve later.
    //    Leave current alone for the brief intermediate state.
    const detach = (): LifecycleBroadcast => {
      const prev = tree.getCurrentId();
      if (prev === null) return { kind: "none" } as LifecycleBroadcast;
      tree.clearCurrent();
      treeStorage.cacheTree(tree);
      return { kind: "notify", reason: "set-current" } as LifecycleBroadcast;
    };
    const noop = (): LifecycleBroadcast => ({ kind: "none" });

    {
      const activeUrl = tabRead.url as Url | undefined;
      const pendingUrl = (tabRead as Tab & { pendingUrl?: string }).pendingUrl;
      // Effective URL: prefer committed url, fall back to pendingUrl
      // when Chrome briefly reports tab.url="" during creation.
      const effectiveUrl = activeUrl && activeUrl.length > 0 ? activeUrl : pendingUrl;
      const isNTP = effectiveUrl ? isNewTabContext(effectiveUrl as Url, tabRead.title) : false;
      const trackable = effectiveUrl ? shouldTrackUrl(effectiveUrl as Url) : false;
      // Untrackable destination — drop stale mapping AND clear
      // current. `lastFocusedTrackedNodeId` is preserved so a fresh
      // node creation in handleNavigation can still parent under the
      // page the user was on before this side-trip.
      if (effectiveUrl && !isNTP && !trackable) {
        if (nodeId !== undefined) tabManager.unregister(tabId);
        return detach();
      }
    }

    if (nodeId === undefined) {
      // No mapping AND we don't yet have a committed URL to classify.
      // Don't disturb current — a webnav for the trackable destination
      // will arrive momentarily and fix things.
      if (!tabRead.url) return noop();
      const url = tabRead.url as Url;
      if (isNewTabContext(url, tabRead.title)) {
        const result = handleNewTabTab(tree, tabRead, url, {
          touch: false,
          setCurrent: false,
        });
        nodeId = result.rootId ?? undefined;
      } else {
        // Trackable URL with no existing node — webnav will create
        // one. noop() rather than detach() so we don't blink current
        // off and on while waiting.
        if (!shouldTrackUrl(url)) return noop();

        // Own extension URLs: never dedup against an existing node
        // (mirrors the onTabCreated rule). Each open is a fresh
        // side-trip; webnav will create a new node under the user's
        // current page rather than yanking current to wherever an
        // old settings node happened to live.
        if (isOwnExtensionUrl(url)) return noop();

        // Only register against an existing node match. Do NOT
        // fabricate a new node here — that was bug #93: activating
        // a pre-existing untracked tab silently created it as a
        // child of `tree.current`, producing false parent edges on
        // every installed-before-extension tab. If no node exists
        // yet, we skip; a real webnav event will trigger node
        // creation with proper opener-derived parent later.
        const existing = tree.findByUrl(url);
        if (!existing) return noop();
        tabManager.register(existing.id, tabId);
        nodeId = existing.id;
      }
    }

    if (nodeId === undefined) return noop();
    // Tracker: tab regained focus — unpause dwell clock.
    trackerOnTabFocus(tabId, Date.now());
    tempSelectionManager.handleTabActivated(tabId);
    if (!tabManager.shouldSuppressTouch(tabId)) {
      tabManager.touch(tabId, nodeId);
      markNodeVisited(tree, nodeId);
    }
    const prevCurrentId = tree.getCurrentId();
    tree.setCurrentById(nodeId);
    lastFocusedTrackedNodeId = nodeId;
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
  // Tracker hook: Chrome fires WINDOW_ID_NONE when the browser loses
  // focus (user alt-tabs out). Propagate this as a "blur" signal to
  // pause dwell counting on the currently-active tab per window.
  if (windowId === browser.windows.WINDOW_ID_NONE) {
    try {
      const activeTabs = await browser.tabs.query({ active: true });
      const nowMs = Date.now();
      for (const t of activeTabs) {
        if (t.id !== undefined) trackerOnTabBlur(t.id as TabId, nowMs);
      }
    } catch {
      // best-effort; ignore
    }
    return;
  }

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
  if (skipIncognito(tab)) return;
  if (changeInfo.audible || changeInfo.mutedInfo) {
    await syncTabAudioState(tabId as TabId, changeInfo, tab);
    return;
  }

  // Some same-document URL changes (tabs.update, session restore
  // reopen, file: navigation after error) don't fire webNavigation
  // but do fire tabs.onUpdated with changeInfo.url. If the tab is
  // currently registered and its URL just changed AWAY from what the
  // node holds, we unregister; a subsequent webNavigation (or a
  // fresh onActivated) will re-register with the right node. This
  // prevents stale tab→node mappings from accumulating.
  if (typeof changeInfo.url === "string" && changeInfo.url.length > 0) {
    const nodeId = tabManager.nodeByTab(tabId as TabId);
    if (nodeId && !shouldTrackUrl(changeInfo.url as Url)) {
      // Tab navigated to an untrackable URL (chrome://, about://,
      // blob:, etc.). Drop the mapping so future meta-patches don't
      // describe the wrong URL. Fixes #67 partially + contributes to
      // #33 (stale mappings for untrackable-URL tabs).
      tabManager.unregister(tabId as TabId);
      // If this was the active tab and the tracked node was the
      // graph's current selection, detach — the user is no longer on
      // a tracked page, so nothing should look "selected".
      if (tab.active) {
        await withTreeLock(async () => {
          const tree = await treeStorage.getOrCreateTree();
          if (tree.getCurrentId() !== nodeId) return;
          tree.clearCurrent();
          treeStorage.cacheTree(tree);
          await notifyTreeUpdate(tree, "set-current");
        });
      }
    }
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
