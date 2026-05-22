import { RPC_METHOD, defineRpcHandlers, type TreeViewIntent } from "@shared/rpc/contracts.js";
import { treeStorage } from "../../services/tree-storage.js";
import { notifyTreeUpdate, notifyTreesUpdate } from "../notifications.js";
import { tabManager } from "../../state/tab-manager.js";
import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import { CommandManager } from "@shared/lib/commands.js";
import type { FaviconUrl, NodeId, TabId, Title, Url } from "@shared/types/ids.js";
import { NavigationTree } from "../../state/nav-tree.js";
import { updateNodeMeta, type NodeData, type NavigationNode } from "@shared/types/node.js";
import { normalizeFaviconUrl, shouldTrackUrl } from "../../utils/url-utils.js";
import { tempSelectionManager } from "../../services/temporary-selection.js";
import { loadTree } from "../../services/tree-loader.js";
import {
  cancelPendingDelete,
  ensureStoredTreePushed,
  fetchRemoteTreePayload,
  periodicPull,
  scheduleDelete,
} from "../../sync/sync-engine.js";
import { authReady, getAuthState } from "@shared/auth/index.js";
import { isTreeStub, type NavigationTreeJSON, type TreeMeta } from "@shared/types/tree.js";
import { EXPORT_SCHEMA, type TrailExportBundle } from "@shared/types/export.js";
import { settingsManager } from "../../services/settings.js";
import {
  saveOpenTabs,
  getOpenTabs,
  clearOpenTabs,
  consumeOpenTabs,
} from "../../services/tab-restoration.js";
import { browser, type Tab } from "@shared/platform/webext.js";
import { createLogger } from "@shared/lib/logger.js";
import {
  openTabsItem,
  pendingSyncOpsItem,
  syncStateItem,
  undoHistoryItem,
  cleanupTombstonesItem,
  layoutPositionsCacheItem,
  localDeleteTombstonesItem,
} from "@shared/config/storage-items.js";
import {
  buildTreeSnapshot,
  buildTreesSnapshot,
  closeTabs,
  closeTabsForNodes,
  collectTabIdsForNodes,
  snapshot,
} from "./snapshots.js";

const log = createLogger("tree-handlers");

function buildNodeDataFromTab(tab: Tab): NodeData | null {
  const urlCandidate = tab.url;
  const pendingCandidate = tab.pendingUrl;
  let rawUrl = urlCandidate || pendingCandidate;
  if (
    !shouldTrackUrl(rawUrl as Url) &&
    pendingCandidate &&
    shouldTrackUrl(pendingCandidate as Url)
  ) {
    rawUrl = pendingCandidate;
  }
  const url = rawUrl as Url;
  const title = tab.title || rawUrl;
  return {
    url,
    title: title as Title,
    favicon: normalizeFaviconUrl(url, tab.favIconUrl as FaviconUrl | undefined),
    pinned: false,
    tags: [],
  } as NodeData;
}

function registerTabForNode(nodeId: NodeId, tab: Tab): void {
  if (tab.id === undefined) return;
  const lastUsed = Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : undefined;
  const registerOptions = lastUsed === undefined ? { touch: true } : { touch: true, lastUsed };
  tabManager.register(nodeId, tab.id as TabId, registerOptions);
}

function ensureRootForTab(tree: NavigationTree, tab: Tab): NavigationNode | null {
  const root = tree.getRoot();
  const data = buildNodeDataFromTab(tab);
  if (!root) {
    if (!data) {
      return null;
    }
    // `tree.navigate` enforces the root-is-NTP invariant: if `data.url`
    // is a real page (not a New Tab URL), the tree synthesises an NTP
    // root first and returns the real-URL CHILD as the landed node.
    // Either way, `landed` is the node this tab should be mapped to —
    // which is what we want: Ctrl+T new-tab tabs map to the synthetic
    // root, real pages map to their own node.
    const landed = tree.navigate(data);
    tree.setCurrent(landed);
    registerTabForNode(landed.id, tab);
    return landed;
  }
  if (data && root.data.url === data.url) {
    root.data = updateNodeMeta(root.data, data);
    tree.refreshSearchEntry(root.id);
  }
  tree.setCurrent(root);
  registerTabForNode(root.id, tab);
  return root;
}

async function switchTree(
  nextTree: NavigationTree,
  nextMeta: TreeMeta,
  rootUrl?: Url | null,
  viewOverride?: TreeViewIntent | null,
  preferredFocusNodeId?: NodeId | null,
): Promise<void> {
  const keepTabs = settingsManager.get().keepTabsOnSwitch;
  // Always open new-tree tabs passively — neither sidepanel nor settings
  // switches should yank the user out of their current tab. Chrome will
  // auto-focus a neighbor when `closeTabs` removes the previously-active
  // tab, so the tree is still visibly "current" without us forcing it.
  const activateNewTabs = false;

  // --- Save open tab URLs for the current tree -------------------------
  if (keepTabs) {
    const currentMeta = await treeStorage.getActiveMeta();
    const currentTree = await treeStorage.getOrCreateTree();
    const openUrls: string[] = [];
    tabManager.openNodes().forEach((nodeId) => {
      const node = currentTree.findNodeById(nodeId);
      if (node?.data.url) openUrls.push(node.data.url);
    });
    await saveOpenTabs(currentMeta.id, openUrls);
  }

  const tabsToClose = collectTabIdsForNodes(tabManager.openNodes());
  tabManager.reset();
  if (tabsToClose) {
    tabManager.ignoreTabs(tabsToClose);
  }
  tempSelectionManager.reset();
  CommandManager.clearHistory();

  await treeStorage.setActiveTree(nextTree, nextMeta);

  // --- Restore previously-open tabs for the target tree ----------------
  const savedUrls = keepTabs ? await getOpenTabs(nextMeta.id) : null;

  let focusNodeId: NodeId | undefined;
  const preferredFocusNode =
    preferredFocusNodeId !== undefined && preferredFocusNodeId !== null
      ? nextTree.findNodeById(preferredFocusNodeId)
      : null;
  const preferredFocusUrl =
    preferredFocusNode?.data.url ?? rootUrl ?? nextTree.getRoot()?.data.url ?? null;

  if (savedUrls && savedUrls.length > 0) {
    let treeChanged = false;
    let createdCount = 0;

    for (const url of savedUrls) {
      // The "focused" tab is the one representing the tree's current
      // node. We still record it as the current node regardless of OS
      // focus, but new-tree tabs always open passively.
      const shouldMarkCurrent = preferredFocusUrl !== null && url === preferredFocusUrl;
      const isActive = shouldMarkCurrent && activateNewTabs;
      let tab: Tab;
      try {
        tab = await browser.tabs.create({ url, active: isActive });
      } catch {
        continue;
      }
      createdCount++;
      const node = nextTree.findByUrl(url as Url);
      if (node && tab.id !== undefined) {
        registerTabForNode(node.id, tab);
        if (shouldMarkCurrent) {
          focusNodeId = node.id;
          nextTree.setCurrent(node);
          treeChanged = true;
        }
      }
    }

    // Only consume the saved-URLs list if we actually created tabs
    // for all of them. On partial failure keep the list so a retry
    // (manual switch-back, next session) can resume (#80).
    if (createdCount === savedUrls.length) {
      await consumeOpenTabs(nextMeta.id);
    }

    // If no active tab was created (e.g. current node URL wasn't in saved list),
    // fall back: open the preferred focus URL
    if (!focusNodeId) {
      const fallbackUrl = preferredFocusUrl;
      let tab: Tab;
      try {
        tab = await browser.tabs.create(
          fallbackUrl ? { url: fallbackUrl, active: activateNewTabs } : { active: activateNewTabs },
        );
      } catch {
        tab = await browser.tabs.create({ active: activateNewTabs });
      }
      if (preferredFocusNode) {
        nextTree.setCurrent(preferredFocusNode);
        registerTabForNode(preferredFocusNode.id, tab);
        focusNodeId = preferredFocusNode.id;
        treeChanged = true;
      } else {
        const rootNode = ensureRootForTab(nextTree, tab);
        if (rootNode) {
          focusNodeId = rootNode.id;
          treeChanged = true;
        }
      }
    }

    if (treeChanged) {
      treeStorage.cacheTree(nextTree);
    }
  } else {
    // No saved tabs — original behaviour: open single preferred tab.
    // `activateNewTabs` controls whether OS focus moves to it; tree
    // state is still updated below regardless.
    let created: Tab;
    try {
      created = await browser.tabs.create(
        preferredFocusUrl
          ? { url: preferredFocusUrl, active: activateNewTabs }
          : { active: activateNewTabs },
      );
    } catch (error) {
      log.error("Failed to open root tab for tree switch", {
        error: error instanceof Error ? error.message : String(error),
      });
      created = await browser.tabs.create({ active: activateNewTabs });
    }
    if (preferredFocusNode) {
      nextTree.setCurrent(preferredFocusNode);
      registerTabForNode(preferredFocusNode.id, created);
      focusNodeId = preferredFocusNode.id;
      treeStorage.cacheTree(nextTree);
    } else {
      const rootNode = ensureRootForTab(nextTree, created);
      if (rootNode) {
        focusNodeId = rootNode.id;
        treeStorage.cacheTree(nextTree);
      }
    }
  }

  const defaultView: TreeViewIntent = {
    fitToView: true,
    mode: "force" as const,
    ...(focusNodeId ? { focusNodeId } : {}),
  };
  const view = viewOverride === null ? undefined : (viewOverride ?? defaultView);
  await notifyTreeUpdate(nextTree, "tree-switch", view);
  await treeStorage.flushSaveNow();

  const closed = await closeTabs(tabsToClose, "tree switch");
  if (closed) {
    tabManager.clearIgnoredTabs(tabsToClose);
  }

  await notifyTreesUpdate(await buildTreesSnapshot());
}

export const treeLifecycleHandlers = defineRpcHandlers({
  async [RPC_METHOD.GET_TREE]() {
    await authReady;
    return await buildTreeSnapshot();
  },

  async [RPC_METHOD.GET_TREES]() {
    await authReady;
    return await buildTreesSnapshot();
  },

  async [RPC_METHOD.CLEAR_TREE]() {
    const tree = await treeStorage.getOrCreateTree();
    if (tree.getRoot()) {
      snapshot(tree, "Clear history");
    }
    tree.clear();
    treeStorage.cacheTree(tree);

    await closeTabsForNodes(tabManager.openNodes());
    await notifyTreeUpdate(tree, "tree-reset");
    await treeStorage.flushSaveNow();
  },

  /**
   * Danger-zone "Clear local data". Wipes every local tree + all
   * tree-adjacent state (sync queue, tab restoration, tombstones,
   * undo history, layout cache, editor state) and starts a fresh
   * empty active tree. Preserves: user settings, auth session,
   * feature flags, onboarding flags, device id, telemetry consent.
   *
   * Browser tabs are NOT touched — the user asked for a data reset,
   * not a browsing-session wipe. A subsequent focus on any tracked
   * URL will re-attach it under the new tree via the lifecycle
   * handler.
   */
  async [RPC_METHOD.RESET_TREE_DATA]() {
    // Drop per-tree mappings first so the tab/nav handlers don't
    // try to write to the tree we're about to wipe.
    tabManager.reset();
    tempSelectionManager.reset();
    CommandManager.clearHistory();

    await treeStorage.clearAllTrees();

    const wipers: Array<[string, () => Promise<void>]> = [
      ["syncState", () => syncStateItem.removeValue()],
      ["pendingSyncOps", () => pendingSyncOpsItem.removeValue()],
      ["openTabs", () => openTabsItem.removeValue()],
      ["undoHistory", () => undoHistoryItem.removeValue()],
      ["cleanupTombstones", () => cleanupTombstonesItem.removeValue()],
      ["localDeleteTombstones", () => localDeleteTombstonesItem.removeValue()],
      ["layoutPositions", () => layoutPositionsCacheItem.removeValue()],
    ];
    for (const [label, fn] of wipers) {
      try {
        await fn();
      } catch (error) {
        log.warn(`resetTreeData: ${label} wipe failed`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Seed a fresh empty active tree so the sidepanel has something
    // to display instead of crashing on null meta.
    const freshMeta = treeStorage.createMeta("Untitled", "system");
    const freshTree = new NavigationTree();
    await treeStorage.setActiveTree(freshTree, freshMeta);
    await treeStorage.flushSaveNow();

    await notifyTreeUpdate(freshTree, "tree-reset");
    await notifyTreesUpdate(await buildTreesSnapshot());

    // If signed in, immediately re-hydrate cloud tree stubs that the
    // reset just wiped out of the local index. Without this, the
    // sidepanel's "other trees" list stays empty until the next
    // periodic pull (up to 60s later), making it look like cloud data
    // was lost. Failures are logged silently — next periodicPull will
    // recover.
    if (getAuthState().status === "signed-in") {
      try {
        await periodicPull();
        await notifyTreesUpdate(await buildTreesSnapshot());
      } catch (error) {
        log.warn("resetTreeData: cloud pull failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  },

  /**
   * Pull a stub's payload from Supabase into local storage. No-op if
   * the entry is already materialized (we still broadcast a refresh
   * so a stale UI cache re-queries).
   */
  async [RPC_METHOD.DOWNLOAD_TREE_LOCALLY](message) {
    const auth = getAuthState();
    if (auth.status !== "signed-in") {
      throw new Error("Sign in before downloading cloud trees.");
    }
    const index = await treeStorage.getTreeIndex();
    const entry = index.find((e) => e.id === message.treeId);
    if (!entry) throw new Error("Tree not found in the local index.");
    // If the blob already exists locally and the entry isn't a stub,
    // there's nothing to download. Treat as success.
    if (!isTreeStub(entry)) {
      const existingBlob = await treeStorage.getStoredTree(message.treeId);
      if (existingBlob) {
        await notifyTreesUpdate(await buildTreesSnapshot());
        return;
      }
    }
    const payload = await fetchRemoteTreePayload(message.treeId);
    if (!payload) {
      throw new Error(
        "Couldn't download this tree. It may have been deleted on the server, or the connection failed.",
      );
    }
    await notifyTreesUpdate(await buildTreesSnapshot());
  },

  /**
   * Ensure a stored tree has been pushed to Supabase, then drop its
   * local blob and re-stub the index entry. Lets the user reclaim
   * local storage while keeping the tree accessible via the cloud.
   *
   * Guards: refuses for the active tree (sidepanel needs the payload),
   * refuses when signed-out (no cloud target), refuses if the upload
   * failed for any reason (conflict, offline, rate-limited, error).
   */
  async [RPC_METHOD.UNLOAD_TREE_TO_CLOUD](message) {
    const auth = getAuthState();
    if (auth.status !== "signed-in") {
      throw new Error("Sign in before unloading trees to the cloud.");
    }
    const active = await treeStorage.getActiveMeta();
    if (active.id === message.treeId) {
      throw new Error(
        "Can't unload the active tree. Open another tree first, then unload this one.",
      );
    }
    const index = await treeStorage.getTreeIndex();
    const entry = index.find((e) => e.id === message.treeId);
    if (!entry) throw new Error("Tree not found in the local index.");
    if (isTreeStub(entry)) {
      // Already cloud-only — nothing to unload.
      return;
    }

    const outcome = await ensureStoredTreePushed(message.treeId);
    if (outcome === "ok") {
      // proceed
    } else if (outcome === "conflict") {
      throw new Error(
        "Server has newer edits from another device. Resolve the conflict before unloading.",
      );
    } else if (outcome === "offline") {
      throw new Error("You're offline. Reconnect and try again.");
    } else if (outcome === "rate_limited") {
      throw new Error("Too many syncs just happened. Wait about a minute and try again.");
    } else if (outcome === "skipped") {
      // Could be: stored record missing (orphan) or signed-out mid-flight.
      throw new Error(
        "This tree's local data is missing or the session ended. Refresh and try again.",
      );
    } else {
      throw new Error("Couldn't upload this tree. Check the sync status and try again.");
    }

    await treeStorage.deleteStoredBlob(message.treeId);
    await treeStorage.stubTreeEntry(message.treeId);
    await notifyTreesUpdate(await buildTreesSnapshot());
  },

  async [RPC_METHOD.NEW_TREE](message) {
    const current = await treeStorage.getOrCreateTree();
    if (current.getRoot()) {
      snapshot(current, "New tree");
    }
    await treeStorage.stashActiveTree();
    const meta = treeStorage.createMeta(message.label);
    const nextTree = new NavigationTree();
    await switchTree(nextTree, meta, null, null, null);
  },

  async [RPC_METHOD.OPEN_TREE](message) {
    // Use tree-loader (handles active tree, stored blob, cloud fetch)
    const loaded = await loadTree(message.treeId);
    if (!loaded) {
      throw new Error(
        "Couldn't load this tree — it's not on this device and the cloud fetch failed. Check your connection and try again.",
      );
    }

    const current = await treeStorage.getOrCreateTree();
    if (current.getRoot()) {
      snapshot(current, "Open tree");
    }
    await treeStorage.stashActiveTree();
    const record = await treeStorage.takeStoredTree(message.treeId);
    if (!record) {
      throw new Error(
        "Tree data is missing on this device — the local index is stale. Try re-syncing by opening and closing the trees list.",
      );
    }
    const nextTree = NavigationTreeMapper.fromTrustedJSON(record.tree);
    const meta: TreeMeta = {
      id: record.id,
      label: record.label,
      labelSource: record.labelSource,
      labelUpdatedAt: record.labelUpdatedAt,
      createdAt: record.createdAt,
    };
    const rootUrl = record.rootUrl ?? nextTree.getRoot()?.data.url ?? null;
    await switchTree(nextTree, meta, rootUrl, undefined, null);
  },

  async [RPC_METHOD.ENSURE_TREE_LOADED](message) {
    const record = await loadTree(message.treeId);
    return Boolean(record);
  },

  async [RPC_METHOD.RENAME_TREE](message) {
    await treeStorage.renameTree(message.treeId, message.label);
    await notifyTreesUpdate(await buildTreesSnapshot());
  },

  async [RPC_METHOD.DELETE_TREE](message) {
    const active = await treeStorage.getActiveMeta();
    const isActive = active.id === message.treeId;

    // Capture restorable snapshot BEFORE mutating storage. Used by the
    // toast-Undo flow (RESTORE_TREE) — without this we can't
    // round-trip the deletion.
    let snapshotMeta: TreeMeta;
    let snapshotTree: NavigationTreeJSON;
    let nodeCountForLog: number;
    if (isActive) {
      const tree = await treeStorage.getOrCreateTree();
      snapshotMeta = { ...active };
      snapshotTree = NavigationTreeMapper.toJSON(tree);
      nodeCountForLog = tree.size();
    } else {
      const record = await treeStorage.getFullStoredRecord(message.treeId);
      if (!record) throw new Error("Tree not found");
      snapshotMeta = {
        id: record.id,
        label: record.label,
        labelSource: record.labelSource,
        labelUpdatedAt: record.labelUpdatedAt,
        createdAt: record.createdAt,
      };
      snapshotTree = record.tree;
      nodeCountForLog = record.nodeCount;
    }

    // Tombstone BEFORE issuing scheduleDelete: a periodic pull arriving
    // while doDelete is in flight would otherwise re-stub this tree
    // since the server row's `deleted_at` is still null until the
    // UPDATE lands. Tombstone-gating in doPull skips tombstoned ids.
    const tombstones = await localDeleteTombstonesItem.getValue();
    await localDeleteTombstonesItem.setValue({
      ...tombstones,
      [message.treeId]: { deletedAt: Date.now() },
    });

    if (isActive) {
      // Reset tab/temp/undo state for the going-away tree before we
      // create the fresh active. Mirrors RESET_TREE_DATA's ordering.
      const tabIds = collectTabIdsForNodes(tabManager.openNodes());
      tabManager.reset();
      tempSelectionManager.reset();
      CommandManager.clearHistory();

      // Drop the now-stale active tree blob + meta.
      await treeStorage.deleteTree(message.treeId);

      // Seed a fresh empty active tree.
      const freshMeta = treeStorage.createMeta("Untitled", "system");
      const freshTree = new NavigationTree();
      await treeStorage.setActiveTree(freshTree, freshMeta);
      await treeStorage.flushSaveNow();

      // Close browser tabs that were tied to the deleted tree's nodes.
      if (tabIds.length > 0) {
        try {
          await browser.tabs.remove(tabIds);
        } catch (error) {
          log.warn("DELETE_TREE: tab removal failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      await clearOpenTabs(message.treeId);
      await notifyTreeUpdate(freshTree, "tree-reset");
      await notifyTreesUpdate(await buildTreesSnapshot());
    } else {
      const removed = await treeStorage.deleteTree(message.treeId);
      if (!removed) throw new Error("Tree not found");
      await clearOpenTabs(message.treeId);
      await notifyTreesUpdate(await buildTreesSnapshot());
    }

    // Fire-and-forget server soft-delete. doDelete enqueues a pending
    // op on transient failure; cross-kind queue dedup ensures any
    // racing push is dropped.
    scheduleDelete(message.treeId);

    log.info("DELETE_TREE", {
      treeId: message.treeId,
      wasActive: isActive,
      nodeCount: nodeCountForLog,
    });

    return {
      deletedTreeId: message.treeId,
      snapshot: {
        meta: snapshotMeta,
        tree: snapshotTree,
        wasActive: isActive,
      },
    };
  },

  async [RPC_METHOD.RESTORE_TREE](message) {
    const { snapshot: snap } = message;
    // Drop any queued delete + tombstone so background drain/pull
    // don't re-delete what we're about to restore.
    await cancelPendingDelete(snap.meta.id);

    if (snap.wasActive) {
      // Stash whatever fresh tree is currently active (likely empty —
      // the one DELETE_TREE seeded), then re-attach the restored tree.
      await treeStorage.stashActiveTree();
      const restored = NavigationTreeMapper.fromTrustedJSON(snap.tree);
      await treeStorage.setActiveTree(restored, snap.meta);
      await treeStorage.flushSaveNow();
      await notifyTreeUpdate(restored, "tree-reset");
      await notifyTreesUpdate(await buildTreesSnapshot());
    } else {
      // Re-stash as a stored tree. addStoredTreeFromJSON re-writes the
      // index entry + blob; subsequent push will upsert with
      // `deleted_at: null` to clear the server-side soft-delete.
      await treeStorage.addStoredTreeFromJSON(snap.meta, snap.tree);
      await notifyTreesUpdate(await buildTreesSnapshot());
    }

    log.info("RESTORE_TREE", { treeId: snap.meta.id, wasActive: snap.wasActive });
  },

  async [RPC_METHOD.EXPORT_TREE](message) {
    let treeJSON: NavigationTreeJSON;
    let label: string;

    if (message.treeId) {
      const record = await treeStorage.getFullStoredRecord(message.treeId);
      if (!record) throw new Error("Tree not found");
      treeJSON = record.tree;
      label = record.label;
    } else {
      const tree = await treeStorage.getOrCreateTree();
      const meta = await treeStorage.getActiveMeta();
      treeJSON = NavigationTreeMapper.toJSON(tree);
      label = meta.label;
    }

    const bundle: TrailExportBundle = {
      schema: EXPORT_SCHEMA,
      exportedAt: Date.now(),
      source: {
        treeId: message.treeId ?? (await treeStorage.getActiveMeta()).id,
        treeLabel: label,
        origin: "extension",
      },
      tree: treeJSON,
      meta: {
        nodeCount: treeJSON.nodeCount,
      },
    };

    return bundle;
  },

  async [RPC_METHOD.IMPORT_TRAIL](message) {
    const { bundle } = message;

    if (bundle.schema !== EXPORT_SCHEMA) {
      throw new Error(`Unsupported schema: ${bundle.schema}`);
    }
    if (!bundle.tree) {
      throw new Error("Invalid bundle: missing tree data");
    }

    const current = await treeStorage.getOrCreateTree();
    if (current.getRoot()) {
      snapshot(current, "Import trail");
    }
    await treeStorage.stashActiveTree();

    const label = bundle.source.treeLabel ?? "Imported Trail";
    const meta = treeStorage.createMeta(label);
    const nextTree = NavigationTreeMapper.fromUntrustedJSON(bundle.tree);

    await switchTree(nextTree, meta, nextTree.getRoot()?.data.url ?? null);

    return { treeId: meta.id };
  },
});
