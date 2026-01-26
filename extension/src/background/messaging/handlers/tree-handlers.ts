import { MSG, defineHandlers, ok, err, type TreeUpdatedInput, type TreesSnapshot, type TreeViewIntent } from '../../../shared/types/messages.js';
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
import { settingsManager } from '../../services/settings.js';
import { tempSelectionManager } from '../../services/temporary-selection.js';
import type { TreeMeta } from '../../../shared/types/tree.js';


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
  return {
    tree: NavigationTreeMapper.toJSON(await treeStorage.getOrCreateTree()),
    openNodeIds: Array.from(tabManager.openNodes()),
    tabStates: await getTabStates(),
    nodeTabCounts: Object.fromEntries(Array.from(tabManager.openNodes()).map(nodeId => [nodeId, tabManager.tabCountForNode(nodeId)])),
    reason: 'sync',
  };
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
    const nextTree = new NavigationTree(settingsManager.get().capacity);
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
    const removed = await treeStorage.deleteArchivedTree(message.treeId);
    if (!removed) return err('Tree not found');
    await notifyTreesUpdate(await buildTreesSnapshot());
    return ok();
  },

  async [MSG.DELETE_NODE](message) {
    const tree = await treeStorage.getOrCreateTree();
    if (!tree.findNodeById(message.nodeId)) return err('Node not found');
    snapshot(tree, 'Delete node');
    const removed = tree.deleteNode(message.nodeId);
    if (removed.length === 0) return err('Node not found');
    await closeTabsForNodes(removed.map(node => node.id));
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, 'delete');
    return ok();
  },

  async [MSG.DELETE_CHILDREN](message) {
    const tree = await treeStorage.getOrCreateTree();
    if (!tree.findNodeById(message.nodeId)) return err('Node not found');
    snapshot(tree, 'Delete children');
    const removed = tree.deleteChildren(message.nodeId);
    if (removed.length === 0) return err('Node not found');
    await closeTabsForNodes(removed.map(node => node.id));
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, 'delete');
    return ok();
  },

  async [MSG.DELETE_WITH_CHILDREN](message) {
    const tree = await treeStorage.getOrCreateTree();
    if (!tree.findNodeById(message.nodeId)) return err('Node not found');
    snapshot(tree, 'Delete subtree');
    const removed = tree.deleteSubtree(message.nodeId);
    if (removed.length === 0) return err('Node not found');
    await closeTabsForNodes(removed.map(node => node.id));
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, 'delete');
    return ok();
  },

  async [MSG.BULK_DELETE](message) {
    const tree = await treeStorage.getOrCreateTree();
    snapshot(tree, 'Delete selection');
    const removedIds: NodeId[] = [];

    for (const id of message.nodeIds) {
      const removed = tree.deleteSubtree(id);
      removedIds.push(...removed.map(node => node.id));
    }

    await closeTabsForNodes(removedIds);
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, 'delete');
    return ok();
  },

  async [MSG.BULK_DELETE_NODES](message) {
    const tree = await treeStorage.getOrCreateTree();
    snapshot(tree, 'Delete selected nodes');
    const removedIds: NodeId[] = [];

    for (const id of message.nodeIds) {
      const removed = tree.deleteNode(id);
      removedIds.push(...removed.map(node => node.id));
    }

    await closeTabsForNodes(removedIds);
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, 'delete');
    return ok();
  },

  async [MSG.BULK_DELETE_RECURSIVE](message) {
    const tree = await treeStorage.getOrCreateTree();
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
        await notifyTreeUpdate(tree, 'delete');
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
    await notifyTreeUpdate(tree, 'delete');
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
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, 'layout');
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
