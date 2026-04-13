import {
  RPC_METHOD,
  defineRpcHandlers,
  ok,
  err,
  type TreeUpdatedInput,
  type TreesSnapshot,
  type TreeViewIntent,
} from "@shared/rpc/contracts.js";
import { getEditorState } from "./editor-handlers.js";
import { treeStorage } from "../../services/tree-storage.js";
import { notifyTreeUpdate, getTabStates, notifyTreesUpdate } from "../notifications.js";
import { tabManager } from "../../state/tab-manager.js";
import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import { CommandManager } from "@shared/lib/commands.js";
import type { Description, FaviconUrl, NodeId, TabId, Title, Url } from "@shared/types/ids.js";
import { NavigationTree } from "../../state/nav-tree.js";
import { type ForEacher } from "@shared/types/foreach.js";
import {
  updateNodeData,
  updateNodeMeta,
  type NodeData,
  type NavigationNode,
} from "@shared/types/node.js";
import { normalizeFaviconUrl, shouldTrackUrl } from "../../utils/url-utils.js";
import { tempSelectionManager } from "../../services/temporary-selection.js";
import { loadTree } from "../../services/tree-loader.js";
import type { TreeMeta, NavigationTreeJSON } from "@shared/types/tree.js";
import { EXPORT_SCHEMA, type TrailExportBundle } from "@shared/types/export.js";
import { settingsManager } from "../../services/settings.js";
import { saveOpenTabs, getOpenTabs, clearOpenTabs } from "../../services/tab-restoration.js";
import { browser, type Tab } from "@shared/platform/webext.js";
import { createLogger } from "@shared/lib/logger.js";

const log = createLogger("tree-handlers");

function reassignTabsForRedirects(redirects: Array<{ from: NodeId; to: NodeId }>): void {
  for (const redirect of redirects) {
    if (redirect.from === redirect.to) continue;
    const tabs = [...tabManager.tabsByNode(redirect.from)];
    for (const tabId of tabs) {
      tabManager.register(redirect.to, tabId as TabId, { touch: true });
    }
  }
}

function getDeleteFocusView(
  tree: NavigationTree,
  prevCurrentId: NodeId | null,
): TreeViewIntent | undefined {
  const nextCurrentId = tree.getCurrentId();
  if (!nextCurrentId || nextCurrentId === prevCurrentId) return undefined;
  return { focusNodeId: nextCurrentId, mode: "force" };
}

function snapshot(tree: NavigationTree, description: string): void {
  CommandManager.saveSnapshot(NavigationTreeMapper.toJSON(tree), description as Description);
}

function collectTabIdsForNodes(nodeIds: ForEacher<NodeId>): TabId[] {
  const tabIds: TabId[] = [];
  nodeIds.forEach((nodeId) => {
    tabManager.tabsByNode(nodeId).forEach((tabId) => tabIds.push(tabId as TabId));
  });
  return Array.from(new Set(tabIds));
}

async function closeTabs(tabIds: TabId[], context: string): Promise<boolean> {
  if (tabIds.length === 0) return true;
  try {
    await browser.tabs.remove(tabIds);
    return true;
  } catch (error) {
    log.error("Failed to close tabs", { context, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

async function closeTabsForNodes(nodeIds: ForEacher<NodeId>): Promise<void> {
  const tabIds = collectTabIdsForNodes(nodeIds);
  await closeTabs(tabIds, "nodes");
}

async function buildTreeSnapshot(): Promise<TreeUpdatedInput> {
  const editorMode = getEditorState();
  const openNodes = Array.from(tabManager.openNodes());
  const nodeRecency: Record<string, number> = {};
  for (const nodeId of openNodes) {
    const r = tabManager.getNodeRecency(nodeId);
    if (r > 0) nodeRecency[nodeId] = r;
  }
  const snapshot: TreeUpdatedInput = {
    tree: NavigationTreeMapper.toJSON(await treeStorage.getOrCreateTree()),
    openNodeIds: openNodes,
    tabStates: await getTabStates(),
    nodeTabCounts: Object.fromEntries(
      openNodes.map((nodeId) => [nodeId, tabManager.tabCountForNode(nodeId)]),
    ),
    nodeRecency,
    reason: "sync",
  };
  if (editorMode.active) {
    snapshot.editorMode = editorMode;
  }
  return snapshot;
}

async function buildTreesSnapshot(): Promise<TreesSnapshot> {
  return {
    active: await treeStorage.getActiveMeta(),
    archived: await treeStorage.getArchivedSummaries(),
  };
}

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
    const created = tree.navigate(data);
    tree.setCurrent(created);
    registerTabForNode(created.id, tab);
    return created;
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

    for (const url of savedUrls) {
      const isActive = preferredFocusUrl !== null && url === preferredFocusUrl;
      let tab: Tab;
      try {
        tab = await browser.tabs.create({ url, active: isActive });
      } catch {
        continue;
      }
      const node = nextTree.findByUrl(url as Url);
      if (node && tab.id !== undefined) {
        registerTabForNode(node.id, tab);
        if (isActive) {
          focusNodeId = node.id;
          nextTree.setCurrent(node);
          treeChanged = true;
        }
      }
    }

    // If no active tab was created (e.g. current node URL wasn't in saved list),
    // fall back: open the preferred focus URL
    if (!focusNodeId) {
      const fallbackUrl = preferredFocusUrl;
      let tab: Tab;
      try {
        tab = await browser.tabs.create(
          fallbackUrl ? { url: fallbackUrl, active: true } : { active: true },
        );
      } catch {
        tab = await browser.tabs.create({});
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
    // No saved tabs — original behaviour: open single preferred tab
    let created: Tab;
    try {
      created = await browser.tabs.create(
        preferredFocusUrl ? { url: preferredFocusUrl, active: true } : { active: true },
      );
    } catch (error) {
      log.error("Failed to open root tab for tree switch", { error: error instanceof Error ? error.message : String(error) });
      created = await browser.tabs.create({});
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

export async function openTreeAndFocusNode(treeId: string, nodeId: NodeId): Promise<void> {
  const loaded = await loadTree(treeId);
  if (!loaded) throw new Error("Tree not found");

  const current = await treeStorage.getOrCreateTree();
  if (current.getRoot()) {
    snapshot(current, "Open node in tree");
  }
  await treeStorage.archiveActiveTree();
  const record = await treeStorage.takeArchivedTree(treeId);
  if (!record) throw new Error("Tree not found");

  const nextTree = NavigationTreeMapper.fromJSON(record.tree);
  const targetNode = nextTree.findNodeById(nodeId);
  if (!targetNode) throw new Error("Node not found");

  const meta: TreeMeta = {
    id: record.id,
    label: record.label,
    labelSource: record.labelSource,
    labelUpdatedAt: record.labelUpdatedAt,
    createdAt: record.createdAt,
  };

  await switchTree(nextTree, meta, targetNode.data.url, undefined, nodeId);
}

export const treeHandlers = defineRpcHandlers({
  async [RPC_METHOD.GET_TREE]() {
    const snapshot = await buildTreeSnapshot();
    return ok(snapshot);
  },

  async [RPC_METHOD.GET_TREES]() {
    const snapshot = await buildTreesSnapshot();
    return ok(snapshot);
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
    return ok();
  },

  async [RPC_METHOD.NEW_TREE](message) {
    const current = await treeStorage.getOrCreateTree();
    if (current.getRoot()) {
      snapshot(current, "New tree");
    }
    await treeStorage.archiveActiveTree();
    const meta = treeStorage.createMeta(message.label);
    const nextTree = new NavigationTree();
    await switchTree(nextTree, meta, null, null);
    return ok();
  },

  async [RPC_METHOD.ARCHIVE_ACTIVE_TREE]() {
    const current = await treeStorage.getOrCreateTree();
    if (current.getRoot()) {
      snapshot(current, "Archive active tree");
    }
    await treeStorage.archiveActiveTree();
    const meta = treeStorage.createMeta("Untitled Tree");
    const nextTree = new NavigationTree();
    await switchTree(nextTree, meta, null, null);
    return ok();
  },

  async [RPC_METHOD.OPEN_TREE](message) {
    // Use tree-loader (handles active tree, archive blob, cloud fetch)
    const loaded = await loadTree(message.treeId);
    if (!loaded) return err("Tree not found");

    const current = await treeStorage.getOrCreateTree();
    if (current.getRoot()) {
      snapshot(current, "Open tree");
    }
    await treeStorage.archiveActiveTree();
    const record = await treeStorage.takeArchivedTree(message.treeId);
    if (!record) return err("Tree not found");
    const nextTree = NavigationTreeMapper.fromJSON(record.tree);
    const meta: TreeMeta = {
      id: record.id,
      label: record.label,
      labelSource: record.labelSource,
      labelUpdatedAt: record.labelUpdatedAt,
      createdAt: record.createdAt,
    };
    const rootUrl = record.rootUrl ?? nextTree.getRoot()?.data.url ?? null;
    await switchTree(nextTree, meta, rootUrl);
    return ok();
  },

  async [RPC_METHOD.ENSURE_TREE_LOADED](message) {
    const record = await loadTree(message.treeId);
    return ok(Boolean(record));
  },

  async [RPC_METHOD.RENAME_TREE](message) {
    await treeStorage.renameTree(message.treeId, message.label);
    await notifyTreesUpdate(await buildTreesSnapshot());
    return ok();
  },

  async [RPC_METHOD.DELETE_ARCHIVED_TREE](message) {
    const active = await treeStorage.getActiveMeta();
    if (active.id === message.treeId) return err("Cannot delete active tree");
    const removed = await treeStorage.deleteArchivedTree(message.treeId);
    if (!removed) return err("Tree not found");
    await clearOpenTabs(message.treeId);
    await notifyTreesUpdate(await buildTreesSnapshot());
    return ok();
  },

  async [RPC_METHOD.EXPORT_TREE](message) {
    let treeJSON: NavigationTreeJSON;
    let label: string;

    if (message.treeId) {
      const record = await treeStorage.getFullArchiveRecord(message.treeId);
      if (!record) return err("Tree not found");
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

    return ok(bundle);
  },

  async [RPC_METHOD.DELETE_NODE](message) {
    const tree = await treeStorage.getOrCreateTree();
    if (!tree.findNodeById(message.nodeId)) return err("Node not found");
    const prevCurrentId = tree.getCurrentId();
    snapshot(tree, "Delete node");
    const result = tree.deleteNode(message.nodeId);
    if (result.removed.length === 0) return err("Node not found");
    await closeTabsForNodes(result.removed.map((node) => node.id));
    reassignTabsForRedirects(result.redirects);
    treeStorage.cacheTree(tree);
    const view = getDeleteFocusView(tree, prevCurrentId);
    await notifyTreeUpdate(tree, "delete", view);
    return ok();
  },

  async [RPC_METHOD.DELETE_CHILDREN](message) {
    const tree = await treeStorage.getOrCreateTree();
    if (!tree.findNodeById(message.nodeId)) return err("Node not found");
    const prevCurrentId = tree.getCurrentId();
    snapshot(tree, "Delete children");
    const removed = tree.deleteChildren(message.nodeId);
    if (removed.length === 0) return err("Node not found");
    await closeTabsForNodes(removed.map((node) => node.id));
    treeStorage.cacheTree(tree);
    const view = getDeleteFocusView(tree, prevCurrentId);
    await notifyTreeUpdate(tree, "delete", view);
    return ok();
  },

  async [RPC_METHOD.DELETE_WITH_CHILDREN](message) {
    const tree = await treeStorage.getOrCreateTree();
    if (!tree.findNodeById(message.nodeId)) return err("Node not found");
    const prevCurrentId = tree.getCurrentId();
    snapshot(tree, "Delete subtree");
    const removed = tree.deleteSubtree(message.nodeId);
    if (removed.length === 0) return err("Node not found");
    await closeTabsForNodes(removed.map((node) => node.id));
    treeStorage.cacheTree(tree);
    const view = getDeleteFocusView(tree, prevCurrentId);
    await notifyTreeUpdate(tree, "delete", view);
    return ok();
  },

  async [RPC_METHOD.BULK_DELETE](message) {
    const tree = await treeStorage.getOrCreateTree();
    const prevCurrentId = tree.getCurrentId();
    snapshot(tree, "Delete selection");
    const removedIds: NodeId[] = [];

    for (const id of message.nodeIds) {
      const removed = tree.deleteSubtree(id);
      removedIds.push(...removed.map((node) => node.id));
    }

    await closeTabsForNodes(removedIds);
    treeStorage.cacheTree(tree);
    const view = getDeleteFocusView(tree, prevCurrentId);
    await notifyTreeUpdate(tree, "delete", view);
    return ok();
  },

  async [RPC_METHOD.BULK_DELETE_NODES](message) {
    const tree = await treeStorage.getOrCreateTree();
    const prevCurrentId = tree.getCurrentId();
    snapshot(tree, "Delete selected nodes");
    const removedIds: NodeId[] = [];

    for (const id of message.nodeIds) {
      const result = tree.deleteNode(id);
      removedIds.push(...result.removed.map((node) => node.id));
      reassignTabsForRedirects(result.redirects);
    }

    await closeTabsForNodes(removedIds);
    treeStorage.cacheTree(tree);
    const view = getDeleteFocusView(tree, prevCurrentId);
    await notifyTreeUpdate(tree, "delete", view);
    return ok();
  },

  async [RPC_METHOD.BULK_DELETE_RECURSIVE](message) {
    const tree = await treeStorage.getOrCreateTree();
    const prevCurrentId = tree.getCurrentId();
    snapshot(tree, "Delete selected nodes recursively");
    const removedIds: NodeId[] = [];
    const selectedIds = new Set<NodeId>(message.nodeIds);
    const candidates: NodeId[] = [];

    for (const id of message.nodeIds) {
      const node = tree.findNodeById(id);
      if (!node) continue;
      if (node.isRoot()) {
        const removed = tree.deleteSubtree(id);
        removedIds.push(...removed.map((n) => n.id));
        await closeTabsForNodes(removedIds);
        treeStorage.cacheTree(tree);
            const view = getDeleteFocusView(tree, prevCurrentId);
        await notifyTreeUpdate(tree, "delete", view);
        return ok();
      }
      candidates.push(id);
    }

    const topLevelIds: NodeId[] = [];
    for (const id of candidates) {
      const node = tree.findNodeById(id);
      if (!node) continue;
      let parent = node.getParent();
      let skip = false;
      while (parent) {
        if (selectedIds.has(parent.id)) {
          skip = true;
          break;
        }
        parent = parent.getParent();
      }
      if (!skip) topLevelIds.push(id);
    }

    for (const id of topLevelIds) {
      const removed = tree.deleteSubtree(id);
      removedIds.push(...removed.map((node) => node.id));
    }

    await closeTabsForNodes(removedIds);
    treeStorage.cacheTree(tree);
    const view = getDeleteFocusView(tree, prevCurrentId);
    await notifyTreeUpdate(tree, "delete", view);
    return ok();
  },

  async [RPC_METHOD.SET_NODE_LAYOUT](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err("Node not found");
    const existingLayout = node.data.layout ?? { offsetX: 0, offsetY: 0 };
    const nextLayout = {
      offsetX: typeof message.offsetX === "number" ? message.offsetX : existingLayout.offsetX,
      offsetY: typeof message.offsetY === "number" ? message.offsetY : existingLayout.offsetY,
      ...(message.radial
        ? { radial: message.radial }
        : existingLayout.radial
          ? { radial: existingLayout.radial }
          : {}),
    };
    const hasChanges =
      typeof message.offsetX === "number" ||
      typeof message.offsetY === "number" ||
      typeof message.radial !== "undefined";
    if (!hasChanges) return ok();
    node.data = updateNodeData(node.data, { layout: nextLayout });
    treeStorage.cacheTree(tree);
    return ok();
  },

  async [RPC_METHOD.SET_NODE_LAYOUT_BATCH](message) {
    const tree = await treeStorage.getOrCreateTree();
    let changed = false;

    for (const layoutUpdate of message.layouts) {
      const node = tree.findNodeById(layoutUpdate.nodeId);
      if (!node) continue;

      const hasChanges =
        typeof layoutUpdate.offsetX === "number" ||
        typeof layoutUpdate.offsetY === "number" ||
        typeof layoutUpdate.radial !== "undefined";
      if (!hasChanges) continue;

      const existingLayout = node.data.layout ?? { offsetX: 0, offsetY: 0 };
      const nextLayout = {
        offsetX:
          typeof layoutUpdate.offsetX === "number" ? layoutUpdate.offsetX : existingLayout.offsetX,
        offsetY:
          typeof layoutUpdate.offsetY === "number" ? layoutUpdate.offsetY : existingLayout.offsetY,
        ...(layoutUpdate.radial
          ? { radial: layoutUpdate.radial }
          : existingLayout.radial
            ? { radial: existingLayout.radial }
            : {}),
      };

      node.data = updateNodeData(node.data, { layout: nextLayout });
      changed = true;
    }

    if (!changed) return ok();

    treeStorage.cacheTree(tree);
    return ok();
  },

  async [RPC_METHOD.IMPORT_TRAIL](message) {
    const { bundle } = message;

    if (bundle.schema !== EXPORT_SCHEMA) {
      return err(`Unsupported schema: ${bundle.schema}`);
    }
    if (!bundle.tree) {
      return err("Invalid bundle: missing tree data");
    }

    const current = await treeStorage.getOrCreateTree();
    if (current.getRoot()) {
      snapshot(current, "Import trail");
    }
    await treeStorage.archiveActiveTree();

    const label = bundle.source.treeLabel ?? "Imported Trail";
    const meta = treeStorage.createMeta(label);
    const nextTree = NavigationTreeMapper.fromJSON(bundle.tree);

    await switchTree(nextTree, meta, nextTree.getRoot()?.data.url ?? null);

    return ok({ treeId: meta.id });
  },

  async [RPC_METHOD.RESET_NODE_LAYOUTS]() {
    const tree = await treeStorage.getOrCreateTree();
    let changed = false;
    for (const node of tree.iter() ?? []) {
      if (node.data.layout) {
        const { layout: _layout, ...rest } = node.data;
        node.data = rest as typeof node.data;
        changed = true;
      }
    }
    if (!changed) return ok();
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, "layout");
    return ok();
  },
});
