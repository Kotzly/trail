import { MSG, defineHandlers, type TreeUpdatedInput } from '../../../shared/types/messages.js';
import { treeStorage } from '../../services/tree-storage.js';
import { notifyTreeUpdate, getTabStates } from '../notifications.js';
import { tabManager } from '../../state/tab-manager.js';
import { NavigationTreeMapper } from '../../../shared/lib/mapper.js';
import { CommandManager } from '../../../shared/lib/commands.js';
import type { Description, NodeId } from '../../../shared/types/ids.js';
import type { NavigationTree } from '../../state/nav-tree.js';
import { ok, err } from '../../../shared/types/messages.js';
import { ForEacher } from '../../../shared/types/foreach.js';


function snapshot(tree: NavigationTree, description: string): void {
  CommandManager.saveSnapshot(
    NavigationTreeMapper.toJSON(tree),
    description as Description,
  );
}

function unregisterTabsForNodes(nodeIds: ForEacher<NodeId>): void {
  nodeIds.forEach(nodeId => {tabManager.tabsByNode(nodeId).forEach(tabId => tabManager.unregister(tabId))});
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

    unregisterTabsForNodes(tabManager.openNodes());
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
    unregisterTabsForNodes(removed.map(node => node.id));
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
    unregisterTabsForNodes(removed.map(node => node.id));
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
    unregisterTabsForNodes(removed.map(node => node.id));
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

    unregisterTabsForNodes(removedIds);
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree);
    return ok();
  },
});
