import { MSG, defineHandlers, ok, err, type TreeUpdatedInput, type TreesSnapshot, type TreeViewIntent } from '../../../shared/types/messages.js';
import { getEditorState } from './editor-handlers.js';
import { treeStorage } from '../../services/tree-storage.js';
import { notifyTreeUpdate, getTabStates, notifyTreesUpdate } from '../notifications.js';
import { tabManager } from '../../state/tab-manager.js';
import { NavigationTreeMapper } from '../../../shared/lib/mapper.js';
import { CommandManager } from '../../../shared/lib/commands.js';
import type { Description, FaviconUrl, NodeId, TabId, Title, Url } from '../../../shared/types/ids.js';
import { NavigationTree } from '../../state/nav-tree.js';
import { ForEacher } from '../../../shared/types/foreach.js';
import { updateNodeData, updateNodeMeta, type NodeData, type NavigationNode } from '../../../shared/types/node.js';
import { normalizeFaviconUrl, shouldTrackUrl } from '../../utils/url-utils.js';
import { tempSelectionManager } from '../../services/temporary-selection.js';
import { cloudSync } from '../../services/cloud-sync.js';
import { editorSyncMarkDirty } from '../../services/editor-sync.js';
import type { TreeMeta } from '../../../shared/types/tree.js';

/** Mark editor sync dirty if currently in editor mode. */
function maybeEditorDirty(): void {
  if (getEditorState().active) editorSyncMarkDirty();
}

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
  prevCurrentId: NodeId | null
): TreeViewIntent | undefined {
  const nextCurrentId = tree.getCurrentId();
  if (!nextCurrentId || nextCurrentId === prevCurrentId) return undefined;
  return { focusNodeId: nextCurrentId, mode: 'force' };
}

function snapshot(tree: NavigationTree, description: string): void {
  CommandManager.saveSnapshot(
    NavigationTreeMapper.toJSON(tree),
    description as Description,
  );
}

function collectTabIdsForNodes(nodeIds: ForEacher<NodeId>): TabId[] {
  const tabIds: TabId[] = [];
  nodeIds.forEach(nodeId => {
    tabManager.tabsByNode(nodeId).forEach(tabId => tabIds.push(tabId as TabId));
  });
  return Array.from(new Set(tabIds));
}

async function closeTabs(tabIds: TabId[], context: string): Promise<boolean> {
  if (tabIds.length === 0) return true;
  try {
    await chrome.tabs.remove(tabIds);
    return true;
  } catch (error) {
    console.error(`Failed to close tabs for ${context}:`, error);
    return false;
  }
}

async function closeTabsForNodes(nodeIds: ForEacher<NodeId>): Promise<void> {
  const tabIds = collectTabIdsForNodes(nodeIds);
  await closeTabs(tabIds, 'nodes');
}

async function buildTreeSnapshot(): Promise<TreeUpdatedInput> {
  const editorMode = getEditorState();
  const snapshot: TreeUpdatedInput = {
    tree: NavigationTreeMapper.toJSON(await treeStorage.getOrCreateTree()),
    openNodeIds: Array.from(tabManager.openNodes()),
    tabStates: await getTabStates(),
    nodeTabCounts: Object.fromEntries(Array.from(tabManager.openNodes()).map(nodeId => [nodeId, tabManager.tabCountForNode(nodeId)])),
    reason: 'sync',
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

function buildNodeDataFromTab(tab: chrome.tabs.Tab): NodeData | null {
  const urlCandidate = tab.url;
  const pendingCandidate = tab.pendingUrl;
  let rawUrl = urlCandidate || pendingCandidate;
  if (!shouldTrackUrl(rawUrl as Url) && pendingCandidate && shouldTrackUrl(pendingCandidate as Url)) {
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

function registerTabForNode(nodeId: NodeId, tab: chrome.tabs.Tab): void {
  if (tab.id === undefined) return;
  const lastUsed = Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : undefined;
  const registerOptions = lastUsed === undefined ? { touch: true } : { touch: true, lastUsed };
  tabManager.register(nodeId, tab.id as TabId, registerOptions);
}

function ensureRootForTab(tree: NavigationTree, tab: chrome.tabs.Tab): NavigationNode | null {
  const root = tree.getRoot();
  const data = buildNodeDataFromTab(tab);
  // No root yet: build it from the newly created tab and mark it current.
  if (!root) {
    // If we can't derive data from the tab, we can't create a root.
    if (!data) {
      return null;
    }
    // Navigate creates the first node when root is missing.
    const created = tree.navigate(data);
    // Keep tree current aligned with the root tab.
    tree.setCurrent(created);
    // Register the tab so we can track open tab <-> node mapping.
    registerTabForNode(created.id, tab);
    return created;
  }
  // If the existing root matches this tab, refresh its metadata (title/favicon).
  if (data && root.data.url === data.url) {
    root.data = updateNodeMeta(root.data, data);
    tree.refreshSearchEntry(root.id);
  }
  // Ensure current node points at root after tree switch.
  tree.setCurrent(root);
  // Make sure the root tab is registered for tab tracking.
  registerTabForNode(root.id, tab);
  return root;
}

async function switchTree(
  nextTree: NavigationTree,
  nextMeta: TreeMeta,
  rootUrl?: Url | null,
  viewOverride?: TreeViewIntent | null,
): Promise<void> {
  const tabsToClose = collectTabIdsForNodes(tabManager.openNodes());
  tabManager.reset();
  if (tabsToClose) {
    tabManager.ignoreTabs(tabsToClose);
  }
  tempSelectionManager.reset();
  CommandManager.clearHistory();

  await treeStorage.setActiveTree(nextTree, nextMeta);

  let created: chrome.tabs.Tab;
  try {
    created = await chrome.tabs.create(rootUrl ? { url: rootUrl, active: true } : { active: true });
  } catch (error) {
    console.error('Failed to open root tab for tree switch:', error);
    created = await chrome.tabs.create({});
  }
  const rootNode = ensureRootForTab(nextTree, created);
  if (rootNode) {
    treeStorage.cacheTree(nextTree);
  }

  const defaultView: TreeViewIntent = {
    fitToView: true,
    mode: 'force' as const,
    ...(rootNode ? { focusNodeId: rootNode.id } : {}),
  };
  const view = viewOverride === null ? undefined : (viewOverride ?? defaultView);
  await notifyTreeUpdate(nextTree, 'tree-switch', view);
  await treeStorage.flushSaveNow();

  const closed = await closeTabs(tabsToClose, 'tree switch');
  if (closed) {
    tabManager.clearIgnoredTabs(tabsToClose);
  }

  await notifyTreesUpdate(await buildTreesSnapshot());
}

export const treeHandlers = defineHandlers({
  async [MSG.GET_TREE]() {
    const snapshot = await buildTreeSnapshot();
    return ok(snapshot);
  },

  async [MSG.GET_TREES]() {
    const snapshot = await buildTreesSnapshot();
    return ok(snapshot);
  },

  async [MSG.CLEAR_TREE]() {
    const tree = await treeStorage.getOrCreateTree();
    if (tree.getRoot()) {
      snapshot(tree, 'Clear history');
    }
    tree.clear();
    treeStorage.cacheTree(tree);

    await closeTabsForNodes(tabManager.openNodes());
    await notifyTreeUpdate(tree, 'tree-reset');
    await treeStorage.flushSaveNow();
    return ok();
  },

  async [MSG.NEW_TREE](message) {
    const current = await treeStorage.getOrCreateTree();
    if (current.getRoot()) {
      snapshot(current, 'New tree');
    }
    await treeStorage.archiveActiveTree();
    const meta = treeStorage.createMeta(message.label);
    const nextTree = new NavigationTree();
    await switchTree(nextTree, meta, null, null);
    return ok();
  },

  async [MSG.OPEN_TREE](message) {
    const current = await treeStorage.getOrCreateTree();
    if (current.getRoot()) {
      snapshot(current, 'Open tree');
    }
    await treeStorage.archiveActiveTree();
    const record = await treeStorage.takeArchivedTree(message.treeId);
    if (!record) return err('Tree not found');
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

  async [MSG.RENAME_TREE](message) {
    await treeStorage.renameTree(message.treeId, message.label);
    await notifyTreesUpdate(await buildTreesSnapshot());
    return ok();
  },

  async [MSG.DELETE_ARCHIVED_TREE](message) {
    const active = await treeStorage.getActiveMeta();
    if (active.id === message.treeId) return err('Cannot delete active tree');
    const archives = await treeStorage.getArchives();
    const archivedRecord = archives.find((entry) => entry.id === message.treeId) ?? null;
    const removed = await treeStorage.deleteArchivedTree(message.treeId);
    if (!removed) return err('Tree not found');
    if (archivedRecord) {
      await cloudSync.recordArchiveDeletion(archivedRecord);
    }
    await notifyTreesUpdate(await buildTreesSnapshot());
    return ok();
  },

  async [MSG.DELETE_NODE](message) {
    const tree = await treeStorage.getOrCreateTree();
    if (!tree.findNodeById(message.nodeId)) return err('Node not found');
    const prevCurrentId = tree.getCurrentId();
    snapshot(tree, 'Delete node');
    const result = tree.deleteNode(message.nodeId);
    if (result.removed.length === 0) return err('Node not found');
    await closeTabsForNodes(result.removed.map(node => node.id));
    reassignTabsForRedirects(result.redirects);
    treeStorage.cacheTree(tree);
    maybeEditorDirty();
    const view = getDeleteFocusView(tree, prevCurrentId);
    await notifyTreeUpdate(tree, 'delete', view);
    return ok();
  },

  async [MSG.DELETE_CHILDREN](message) {
    const tree = await treeStorage.getOrCreateTree();
    if (!tree.findNodeById(message.nodeId)) return err('Node not found');
    const prevCurrentId = tree.getCurrentId();
    snapshot(tree, 'Delete children');
    const removed = tree.deleteChildren(message.nodeId);
    if (removed.length === 0) return err('Node not found');
    await closeTabsForNodes(removed.map(node => node.id));
    treeStorage.cacheTree(tree);
    maybeEditorDirty();
    const view = getDeleteFocusView(tree, prevCurrentId);
    await notifyTreeUpdate(tree, 'delete', view);
    return ok();
  },

  async [MSG.DELETE_WITH_CHILDREN](message) {
    const tree = await treeStorage.getOrCreateTree();
    if (!tree.findNodeById(message.nodeId)) return err('Node not found');
    const prevCurrentId = tree.getCurrentId();
    snapshot(tree, 'Delete subtree');
    const removed = tree.deleteSubtree(message.nodeId);
    if (removed.length === 0) return err('Node not found');
    await closeTabsForNodes(removed.map(node => node.id));
    treeStorage.cacheTree(tree);
    maybeEditorDirty();
    const view = getDeleteFocusView(tree, prevCurrentId);
    await notifyTreeUpdate(tree, 'delete', view);
    return ok();
  },

  async [MSG.BULK_DELETE](message) {
    const tree = await treeStorage.getOrCreateTree();
    const prevCurrentId = tree.getCurrentId();
    snapshot(tree, 'Delete selection');
    const removedIds: NodeId[] = [];

    for (const id of message.nodeIds) {
      const removed = tree.deleteSubtree(id);
      removedIds.push(...removed.map(node => node.id));
    }

    await closeTabsForNodes(removedIds);
    treeStorage.cacheTree(tree);
    maybeEditorDirty();
    const view = getDeleteFocusView(tree, prevCurrentId);
    await notifyTreeUpdate(tree, 'delete', view);
    return ok();
  },

  async [MSG.BULK_DELETE_NODES](message) {
    const tree = await treeStorage.getOrCreateTree();
    const prevCurrentId = tree.getCurrentId();
    snapshot(tree, 'Delete selected nodes');
    const removedIds: NodeId[] = [];

    for (const id of message.nodeIds) {
      const result = tree.deleteNode(id);
      removedIds.push(...result.removed.map(node => node.id));
      reassignTabsForRedirects(result.redirects);
    }

    await closeTabsForNodes(removedIds);
    treeStorage.cacheTree(tree);
    maybeEditorDirty();
    const view = getDeleteFocusView(tree, prevCurrentId);
    await notifyTreeUpdate(tree, 'delete', view);
    return ok();
  },

  async [MSG.BULK_DELETE_RECURSIVE](message) {
    const tree = await treeStorage.getOrCreateTree();
    const prevCurrentId = tree.getCurrentId();
    snapshot(tree, 'Delete selected nodes recursively');
    const removedIds: NodeId[] = [];
    const selectedIds = new Set<NodeId>(message.nodeIds);
    const candidates: NodeId[] = [];

    for (const id of message.nodeIds) {
      const node = tree.findNodeById(id);
      if (!node) continue;
      if (node.isRoot()) {
        const removed = tree.deleteSubtree(id);
        removedIds.push(...removed.map(n => n.id));
        await closeTabsForNodes(removedIds);
        treeStorage.cacheTree(tree);
        maybeEditorDirty();
        const view = getDeleteFocusView(tree, prevCurrentId);
        await notifyTreeUpdate(tree, 'delete', view);
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
      removedIds.push(...removed.map(node => node.id));
    }

    await closeTabsForNodes(removedIds);
    treeStorage.cacheTree(tree);
    maybeEditorDirty();
    const view = getDeleteFocusView(tree, prevCurrentId);
    await notifyTreeUpdate(tree, 'delete', view);
    return ok();
  },

  async [MSG.SET_NODE_LAYOUT](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err('Node not found');
    const existingLayout = node.data.layout ?? { offsetX: 0, offsetY: 0 };
    const nextLayout = {
      offsetX: typeof message.offsetX === 'number' ? message.offsetX : existingLayout.offsetX,
      offsetY: typeof message.offsetY === 'number' ? message.offsetY : existingLayout.offsetY,
      ...(message.radial
        ? { radial: message.radial }
        : existingLayout.radial
          ? { radial: existingLayout.radial }
          : {}),
    };
    const hasChanges =
      typeof message.offsetX === 'number' ||
      typeof message.offsetY === 'number' ||
      typeof message.radial !== 'undefined';
    if (!hasChanges) return ok();
    node.data = updateNodeData(node.data, { layout: nextLayout });
    // Save silently — the sidepanel already has the correct position via
    // dragPreview / local state.  Sending TREE_UPDATED here would cause a
    // full re-render and stale intermediate positions arriving after drag
    // ends produce a visible double-move glitch.
    treeStorage.cacheTree(tree);
    maybeEditorDirty();
    return ok();
  },

  async [MSG.SET_NODE_LAYOUT_BATCH](message) {
    const tree = await treeStorage.getOrCreateTree();
    let changed = false;

    for (const layoutUpdate of message.layouts) {
      const node = tree.findNodeById(layoutUpdate.nodeId);
      if (!node) continue;

      const hasChanges =
        typeof layoutUpdate.offsetX === 'number' ||
        typeof layoutUpdate.offsetY === 'number' ||
        typeof layoutUpdate.radial !== 'undefined';
      if (!hasChanges) continue;

      const existingLayout = node.data.layout ?? { offsetX: 0, offsetY: 0 };
      const nextLayout = {
        offsetX:
          typeof layoutUpdate.offsetX === 'number'
            ? layoutUpdate.offsetX
            : existingLayout.offsetX,
        offsetY:
          typeof layoutUpdate.offsetY === 'number'
            ? layoutUpdate.offsetY
            : existingLayout.offsetY,
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

    // Keep drag updates silent to avoid extra TREE_UPDATED churn during pan/drag.
    treeStorage.cacheTree(tree);
    maybeEditorDirty();
    return ok();
  },

  async [MSG.RESET_NODE_LAYOUTS]() {
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
    await notifyTreeUpdate(tree, 'layout');
    return ok();
  },
});
