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
import { onNavigation as trackerOnNavigation, DEFAULT_THRESHOLDS } from "./nav-pattern-tracker.js";
import { pruneGlance, reviveFromTombstone } from "../services/cleanup-policy.js";
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

  // Record the URL for legacy callers; the real per-tab trail is
  // `redirectDetector.pushHistory` below, after we know the nodeId.
  const incomingUrl = { url: url as Url, timestamp: now() } as UrlWithTimestamp;
  redirectDetector.recordTabUrl(tabId as TabId, incomingUrl);

  // Round-trip check (Layer 2). If this URL appears in the tab's
  // recent history, we're returning from a detour (captcha resolve,
  // quick glance back to feed, etc.). Restore the mapping and skip
  // tree mutation entirely.
  const roundTrip = redirectDetector.findRoundTrip(tabId as TabId, url as Url);

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

      // Round-trip fast-path (Layer 2 cleanup). If this URL matches an
      // earlier entry in the tab's history AND the matched node still
      // exists, we're returning from a detour. Just re-register the
      // mapping to the original node and exit — no child created, no
      // mutation. This handles "captcha solved, back to search" and
      // "glanced at a link, hit back" cleanly, independent of dwell.
      if (roundTrip && roundTrip.nodeId) {
        const target = tree.findNodeById(roundTrip.nodeId);
        if (target) {
          tabManager.register(target.id, tabId as TabId, registerOptions(isActiveTab));
          if (isActiveTab) {
            markNodeVisited(tree, target.id, lastUsed);
            tree.setCurrentById(target.id);
            didUpdateCurrent = true;
          } else if (prevCurrentId !== null) {
            tree.setCurrentById(prevCurrentId);
          }
          if (didUpdateCurrent) treeStorage.cacheTree(tree);
          redirectDetector.pushHistory(
            tabId as TabId,
            url as Url,
            target.id,
            incomingUrl.timestamp,
          );
          if (isActiveTab) {
            const view: TreeViewIntent = { focusNodeId: target.id, mode: "force" };
            return { kind: "notify", reason: "navigate", view };
          }
          return { kind: "none" };
        }
      }

      if (existingNodeId !== undefined) {
        // Tab already has a node
        const node = tree.findNodeById(existingNodeId);
        if (node && createUrlKey(node.data.url) !== createUrlKey(url as Url)) {
          // Different URL
          const nodeUrl = node.data.url as Url;
          if (!shouldTrackUrl(nodeUrl) && !node.isRoot()) {
            // Tab was on an untrackable URL (about:blank, chrome-ext://,
            // etc.) and is now landing on a real page. Rewrite the
            // placeholder node's URL in place — but NEVER do this for
            // the tree's root (bug #12: about:blank popup → real URL
            // would silently overwrite the user's persistent root).
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
            //
            // Previously there was an "isRedirectHop" branch here that
            // mutated the existing node's URL in place. It was removed:
            // it destroyed synced user history when challenge/captcha
            // pages landed on a tab mapped to a real node. Challenge
            // URLs are now filtered upstream by a deny-list (Layer 1);
            // redirect chains that produce cruft are handled by
            // round-trip detection (Layer 2) and glance prune (Layer 3).
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

      // Push to history AFTER mutation — record the actual node this
      // navigation resolved to. On a later return, findRoundTrip
      // looks up the entry and restores this exact node.
      const resolvedId = tabManager.nodeByTab(tabId as TabId) ?? null;
      redirectDetector.pushHistory(tabId as TabId, url as Url, resolvedId, incomingUrl.timestamp);

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

  // Layer 3 classification: runs AFTER notify so UI isn't blocked on
  // policy decisions. tracker.onNavigation returns how to treat the
  // PREVIOUS nav on this tab (now that we know its dwell).
  // - glance: prune silently (keeps a tombstone for 72h revival)
  // - burst-step / burst-seal: consumed by the burst detector (Phase D)
  // - engaged / none: keep as-is
  try {
    const resolvedNodeId = tabManager.nodeByTab(tabId as TabId) ?? null;
    const classification = trackerOnNavigation(
      tabId as TabId,
      url as Url,
      resolvedNodeId,
      incomingUrl.timestamp,
      {
        ...DEFAULT_THRESHOLDS,
        glanceMs: settingsManager.get().cleanup?.glance?.thresholdMs ?? DEFAULT_THRESHOLDS.glanceMs,
      },
    );
    if (classification.kind === "glance") {
      await pruneGlance(classification.nodeId);
    }
    // burst-step / burst-seal / engaged / none: Phase D + D-adjacent
    // consumers handle. No-op here.
  } catch (error) {
    log.warn("Pattern tracker / glance prune failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Revival fast-path: if the incoming URL has a tombstone, recreate
  // the node at the original parent. Runs late so a race with pruning
  // elsewhere can't double-write.
  try {
    const revived = await reviveFromTombstone(url as Url);
    if (revived) {
      const tree = await treeStorage.getOrCreateTree();
      const revivedNode = tree.findNodeById(revived.nodeId);
      if (revivedNode) {
        tabManager.register(revivedNode.id, tabId as TabId, registerOptions(isActiveTab));
        await notifyTreeUpdate(tree, "navigate", { focusNodeId: revivedNode.id, mode: "force" });
      }
    }
  } catch (error) {
    log.warn("Revive from tombstone failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
