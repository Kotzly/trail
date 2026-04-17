import {
  now,
  type UrlWithTimestamp,
  type FaviconUrl,
  type TabId,
  type Title,
  type Url,
} from "@shared/types/ids.js";
import type { TreeViewIntent } from "@shared/rpc/contracts.js";
import { type NodeMetaPatch, updateNodeMeta, type NodeData } from "@shared/types/node.js";
import { tabManager } from "../state/tab-manager.js";
import { treeStorage, withTreeLock } from "../services/tree-storage.js";
import { redirectDetector } from "./redirect-detection.js";
import { isNewTabContext, normalizeFaviconUrl, shouldTrackUrl } from "../utils/url-utils.js";
import { settingsManager } from "../services/settings.js";
import { handleNewTabTab } from "../utils/new-tab.js";
import { notifyTreeUpdate } from "../messaging/notifications.js";
import { createUrlKey } from "@shared/lib/url-key.js";
import { browser, type Browser, type Tab } from "@shared/platform/webext.js";
import { markNodeVisited } from "../state/node-recency.js";
import { createLogger } from "@shared/lib/logger.js";
import { getEditorState, saveEditorMode } from "../messaging/handlers/editor-handlers.js";

const log = createLogger("navigation");

type NavigationBroadcast =
  | { kind: "none" }
  | { kind: "notify"; reason: "navigate" | "sync" | "tabs"; view: TreeViewIntent | undefined };

/**
 * Handle navigation events and add to tree.
 *
 * Lock discipline: Chrome API reads (tabs.get, tabs.query) run OUTSIDE
 * the tree mutex; only the tree mutation block acquires the lock. The
 * post-mutation `notifyTreeUpdate` broadcast also runs outside the
 * lock so a slow sidepanel listener never stalls the next webnav
 * handler. See the plan's "Narrow lock scope" principle.
 */
export async function handleNavigation(
  details: Browser.webNavigation.WebNavigationFramedCallbackDetails,
  _transitionType?: string,
): Promise<void> {
  const { tabId, url, frameId } = details;
  // Only track main frame navigations
  if (frameId !== 0) return;
  if (tabManager.isIgnoredTab(tabId as TabId)) return;

  // Defer any navigation arriving before settings load. Chrome queues
  // webNav events on the service-worker task queue; awaiting here just
  // serializes us behind the first settings fetch (typically <100ms).
  // Without this, the first navs after SW wake would hit a default-deny
  // blocklist and be dropped.
  if (!settingsManager.isReady()) {
    await settingsManager.ready;
  }

  // Auto-exit editor mode when user navigates in the active tab
  const editorState = getEditorState();
  if (editorState.active) {
    try {
      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id === tabId && shouldTrackUrl(url as Url)) {
        await saveEditorMode();
      }
    } catch (e) {
      log.error("Auto-exit editor on navigation failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Ensure tab still exists (read outside the lock)
  let tab: Tab;
  try {
    tab = await browser.tabs.get(tabId);
  } catch {
    return; // Tab no longer exists
  }

  // Respect the privacy setting to skip incognito windows.
  if (tab.incognito && settingsManager.get().privacy.skipIncognito) {
    return;
  }

  // Early handling for new-tab variants: always map them to the root node.
  if (isNewTabContext(url as Url, tab.title)) {
    let broadcast: NavigationBroadcast = { kind: "none" };
    try {
      broadcast = await withTreeLock(async () => {
        const tree = await treeStorage.getOrCreateTree();
        const result = handleNewTabTab(tree, tab, url as Url, {
          touch: tab.active,
          setCurrent: tab.active,
        });
        if (!result.handled) return { kind: "none" } as NavigationBroadcast;
        if (result.didMutate || result.didUpdateCurrent) {
          treeStorage.cacheTree(tree);
        }
        const currentId = tree.getCurrentId();
        const view: TreeViewIntent | undefined =
          tab.active && currentId !== null ? { focusNodeId: currentId, mode: "force" } : undefined;
        // Broadcast requires the serialized JSON; do it outside the lock.
        return { kind: "notify", reason: "tabs", view };
      });
    } catch (error) {
      log.error("New tab navigation error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    if (broadcast.kind === "notify") {
      const tree = await treeStorage.getOrCreateTree();
      await notifyTreeUpdate(tree, broadcast.reason, broadcast.view);
    }
    return;
  }

  // Skip ignored URLs
  if (!shouldTrackUrl(url as Url)) return;

  // Build the immutable inputs outside the lock.
  const data: NodeData = {
    url: url as Url,
    title: (tab.title || url) as Title,
    favicon: normalizeFaviconUrl(url as Url, tab.favIconUrl as FaviconUrl | undefined),
    pinned: Boolean(tab.pinned),
    tags: [],
  } as NodeData;
  const metaPatch = { title: data.title, favicon: data.favicon } as NodeMetaPatch;
  const lastUsed = Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : undefined;
  const registerOptions = (touch: boolean) =>
    lastUsed === undefined ? { touch } : { touch, lastUsed };
  const isActiveTab = tab.active;

  // Track URL for about:blank redirect detection (safe outside lock —
  // redirectDetector is a dedicated tab-keyed map, not the tree).
  redirectDetector.recordTabUrl(
    tabId as TabId,
    { url: url as Url, timestamp: now() } as UrlWithTimestamp,
  );

  // Resolve the opener-derived parent. Order of preference:
  //   1. opener tab's currently-registered node
  //   2. opener tab's last known node (persisted in storage.session)
  //   3. this tab's own last known node (fallback for SW suspend)
  //   4. null → navigateUnder will attach to root (not tree.current)
  // This runs outside the lock; tabManager reads are synchronous.
  const openerTabId = tab.openerTabId as TabId | undefined;
  const openerDerivedParentId =
    openerTabId !== undefined
      ? (tabManager.nodeByTab(openerTabId) ?? tabManager.lastNodeByTabId(openerTabId) ?? null)
      : (tabManager.lastNodeByTabId(tabId as TabId) ?? null);

  let broadcast: NavigationBroadcast = { kind: "none" };
  try {
    broadcast = await withTreeLock(async () => {
      let wasNewNodeCreated = false;
      let didUpdateCurrent = false;

      // Re-read tab↔node mapping inside the lock (another handler
      // may have unregistered the tab between our tab.get and here).
      const existingNodeId = tabManager.nodeByTab(tabId as TabId);

      const tree = await treeStorage.getOrCreateTree();
      const prevCurrentId = tree.getCurrentId();
      let didMutate = false;

      if (existingNodeId !== undefined) {
        // Tab already has a node
        const node = tree.findNodeById(existingNodeId);
        if (node && createUrlKey(node.data.url) !== createUrlKey(url as Url)) {
          // Different URL
          const nodeUrl = node.data.url as Url;
          if (!shouldTrackUrl(nodeUrl)) {
            node.data = {
              ...node.data,
              url: data.url,
              title: data.title,
              favicon: data.favicon,
            } as NodeData;
            didMutate = true;
            tabManager.register(node.id, tabId as TabId, registerOptions(isActiveTab));
            if (isActiveTab) {
              markNodeVisited(tree, node.id, lastUsed);
            }
            if (!isActiveTab && prevCurrentId !== null) {
              tree.setCurrentById(prevCurrentId);
            } else {
              tree.setCurrentById(node.id);
              didUpdateCurrent = true;
            }
          } else {
            // Normal behavior: attach new node as child of the EXISTING
            // node (same tab continuing its trail), not tree.current.
            didMutate = true;
            const newNode = tree.navigateUnder(existingNodeId, data, {
              setAsCurrent: isActiveTab,
            });
            wasNewNodeCreated = true;
            // Re-register tab with new node (global) — this automatically unregisters from old node
            tabManager.register(newNode.id, tabId as TabId, registerOptions(isActiveTab));
            if (isActiveTab) {
              markNodeVisited(tree, newNode.id, lastUsed);
              didUpdateCurrent = true;
            }
          }
        } else if (node) {
          // Same URL — only update current if tab is active
          const updated = updateNodeMeta(node.data, metaPatch);
          if (updated.title !== node.data.title || updated.favicon !== node.data.favicon) {
            node.data = updated;
            tree.refreshSearchEntry(node.id);
            didMutate = true;
          }
          if (tab.active) {
            tree.setCurrentById(existingNodeId);
            didUpdateCurrent = true;
          }
        }
        if (isActiveTab) {
          tabManager.touch(tabId as TabId, existingNodeId);
          const resolvedNodeId = tabManager.nodeByTab(tabId as TabId);
          if (resolvedNodeId !== undefined) {
            markNodeVisited(tree, resolvedNodeId, lastUsed);
          }
        }
      } else {
        // New tab without existing node — use opener-derived parent
        let newNode;

        // Try URL dedup first (user returning to same URL in a new tab
        // of an existing opener subtree).
        const existingNodeInWindow = tree.findByUrl(url as Url);

        if (existingNodeInWindow) {
          newNode = existingNodeInWindow;
          const updated = updateNodeMeta(newNode.data, metaPatch);
          if (updated.title !== newNode.data.title || updated.favicon !== newNode.data.favicon) {
            newNode.data = updated;
            tree.refreshSearchEntry(newNode.id);
            didMutate = true;
          }
          if (isActiveTab) {
            tree.setCurrentById(newNode.id);
            didUpdateCurrent = true;
          }
          tabManager.register(newNode.id, tabId as TabId, registerOptions(isActiveTab));
          if (isActiveTab) {
            markNodeVisited(tree, newNode.id, lastUsed);
          }
        } else {
          // Attach under opener's node (or root, if opener unknown).
          // Never uses tree.current as parent — that was the core bug.
          didMutate = true;
          newNode = tree.navigateUnder(openerDerivedParentId, data, {
            setAsCurrent: isActiveTab,
          });
          wasNewNodeCreated = true;
          tabManager.register(newNode.id, tabId as TabId, registerOptions(isActiveTab));
          if (isActiveTab) {
            markNodeVisited(tree, newNode.id, lastUsed);
            didUpdateCurrent = true;
          } else if (prevCurrentId !== null) {
            // Background tab: restore the UI cursor to whatever the
            // sidepanel was showing before we touched the tree.
            tree.setCurrentById(prevCurrentId);
          }
        }
      }

      if (didMutate || didUpdateCurrent) {
        treeStorage.cacheTree(tree);
      }

      // Decide broadcast intent; actual send happens outside the lock.
      if (isActiveTab || wasNewNodeCreated) {
        const reason: "navigate" | "sync" = isActiveTab ? "navigate" : "sync";
        const currentId = tree.getCurrentId();
        const view: TreeViewIntent | undefined =
          isActiveTab && currentId !== null ? { focusNodeId: currentId, mode: "force" } : undefined;
        return { kind: "notify", reason, view };
      }
      return { kind: "none" };
    });
  } catch (error) {
    log.error("Navigation error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  if (broadcast.kind === "notify") {
    const tree = await treeStorage.getOrCreateTree();
    await notifyTreeUpdate(tree, broadcast.reason, broadcast.view);
  }
}
