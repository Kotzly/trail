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
import { treeStorage } from "../services/tree-storage.js";
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

/**
 * Handle navigation events and add to tree.
 * Always uses multi-tab mode.
 */
export async function handleNavigation(
  details: Browser.webNavigation.WebNavigationFramedCallbackDetails,
  _transitionType?: string,
): Promise<void> {
  const { tabId, url, frameId } = details;
  // Only track main frame navigations
  if (frameId !== 0) return;
  if (tabManager.isIgnoredTab(tabId as TabId)) return;

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

  // Ensure tab still exists
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
    try {
      const tree = await treeStorage.getOrCreateTree();
      const result = handleNewTabTab(tree, tab, url as Url, {
        touch: tab.active,
        setCurrent: tab.active,
      });
      if (result.handled) {
        if (result.didMutate || result.didUpdateCurrent) {
          treeStorage.cacheTree(tree);
        }
        const currentId = tree.getCurrentId();
        const view: TreeViewIntent | undefined =
          tab.active && currentId !== null ? { focusNodeId: currentId, mode: "force" } : undefined;
        await notifyTreeUpdate(tree, "tabs", view);
      }
    } catch (error) {
      log.error("New tab navigation error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  // Skip ignored URLs
  if (!shouldTrackUrl(url as Url)) return;

  try {
    // CRITICAL: Only update currentNode if this tab is active (user navigated)
    // If tab is not active, it was created programmatically - don't switch focus
    const isActiveTab = tab.active;

    // Track whether we create a new node (vs reusing existing)
    let wasNewNodeCreated = false;
    let didUpdateCurrent = false;

    // Track URL for about:blank redirect detection
    redirectDetector.recordTabUrl(
      tabId as TabId,
      { url: url as Url, timestamp: now() } as UrlWithTimestamp,
    );

    // Check if this tab is already registered to a node (global)
    const existingNodeId = tabManager.nodeByTab(tabId as TabId);

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

    // Use GLOBAL tree - shared across all windows
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
          // Normal behavior: navigate from current node (creates child)
          tree.setCurrentById(existingNodeId);
          didMutate = true;
          const newNode = tree.navigate(data);
          wasNewNodeCreated = true; // New node was created
          // Re-register tab with new node (global) - this automatically unregisters from old node
          tabManager.register(newNode.id, tabId as TabId, registerOptions(isActiveTab));
          if (isActiveTab) {
            markNodeVisited(tree, newNode.id, lastUsed);
          }
          // Update currentNode to new node only if tab is active
          if (!isActiveTab && prevCurrentId !== null) {
            tree.setCurrentById(prevCurrentId);
          } else {
            didUpdateCurrent = true;
          }
        }
      } else if (node) {
        // Same URL - only update current if tab is active
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
      // New tab without existing node
      let newNode;

      // First, try to find existing node with this URL globally
      const existingNodeInWindow = tree.findByUrl(url as Url);

      // If found existing node, use it instead of creating new
      if (existingNodeInWindow) {
        newNode = existingNodeInWindow;
        const updated = updateNodeMeta(newNode.data, metaPatch);
        if (updated.title !== newNode.data.title || updated.favicon !== newNode.data.favicon) {
          newNode.data = updated;
          tree.refreshSearchEntry(newNode.id);
          didMutate = true;
        }
        // Only update currentNode if tab is active (user navigated, not programmatic)
        if (isActiveTab) {
          tree.setCurrentById(newNode.id);
          didUpdateCurrent = true;
        }
        // Register this tab with the existing node - this automatically unregisters from old node if any
        tabManager.register(newNode.id, tabId as TabId, registerOptions(isActiveTab));
        if (isActiveTab) {
          markNodeVisited(tree, newNode.id, lastUsed);
        }
      } else {
        didMutate = true;
        newNode = tree.navigate(data);
        wasNewNodeCreated = true;
        tabManager.register(newNode.id, tabId as TabId, registerOptions(isActiveTab));
        if (isActiveTab) {
          markNodeVisited(tree, newNode.id, lastUsed);
        }
        if (!isActiveTab && prevCurrentId !== null) {
          tree.setCurrentById(prevCurrentId);
        } else {
          didUpdateCurrent = true;
        }
      }
    }

    if (didMutate || didUpdateCurrent) {
      treeStorage.cacheTree(tree);
    }

    // Only notify if tab is active OR if we created a new node (not just reused existing)
    // This prevents unnecessary UI updates for programmatic tab creation
    // For inactive tabs, only notify if a new node was actually created
    if (isActiveTab || wasNewNodeCreated) {
      const reason = isActiveTab ? "navigate" : "sync";
      const currentId = tree.getCurrentId();
      const view: TreeViewIntent | undefined =
        isActiveTab && currentId !== null ? { focusNodeId: currentId, mode: "force" } : undefined;
      await notifyTreeUpdate(tree, reason, view);
    }
  } catch (error) {
    log.error("Navigation error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
