import { MSG, defineHandlers, ok, err, type TreeUpdatedInput } from '../../../shared/types/messages.js';
import { treeStorage } from '../../services/tree-storage.js';
import { notifyTreeUpdate, getTabStates } from '../notifications.js';
import { tabManager } from '../../state/tab-manager.js';
import { NavigationTreeMapper } from '../../../shared/lib/mapper.js';
import { CommandManager } from '../../../shared/lib/commands.js';
import type { Description, NodeId, TabId } from '../../../shared/types/ids.js';
import type { NavigationTree } from '../../state/nav-tree.js';
import { ForEacher } from '../../../shared/types/foreach.js';
import { updateNodeData } from '../../../shared/types/node.js';


function snapshot(tree: NavigationTree, description: string): void {
  CommandManager.saveSnapshot(
    NavigationTreeMapper.toJSON(tree),
    description as Description,
  );
}

async function closeTabsForNodes(nodeIds: ForEacher<NodeId>): Promise<void> {
  const tabIds: TabId[] = [];
  nodeIds.forEach(nodeId => {
    tabManager.tabsByNode(nodeId).forEach(tabId => tabIds.push(tabId as TabId));
  });
  if (tabIds.length === 0) return;
  chrome.tabs.remove(tabIds).catch((e) => console.error('Failed to close tabs for nodes:', e));
}

async function buildTreeSnapshot(): Promise<TreeUpdatedInput> {
  return {
    tree: NavigationTreeMapper.toJSON(await treeStorage.getOrCreateTree()),
    openNodeIds: Array.from(tabManager.openNodes()),
    tabStates: await getTabStates(),
    nodeTabCounts: Object.fromEntries(Array.from(tabManager.openNodes()).map(nodeId => [nodeId, tabManager.tabCountForNode(nodeId)])),
  };
}

export const treeHandlers = defineHandlers({
  async [MSG.GET_TREE]() {
    const snapshot = await buildTreeSnapshot();
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
    await notifyTreeUpdate(tree);
    await treeStorage.flushSaveNow();
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
    await notifyTreeUpdate(tree);
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
    await notifyTreeUpdate(tree);
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
    await notifyTreeUpdate(tree);
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
    await notifyTreeUpdate(tree);
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
    await notifyTreeUpdate(tree);
    return ok();
  },
});
