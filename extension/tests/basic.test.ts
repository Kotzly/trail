import assert from 'node:assert/strict';

import type { NodeData, NavigationNodeJSON } from '../src/shared/types/node.js';
import type { Description, NodeId, Timestamp, Url, Title } from '../src/shared/types/ids.js';
import type { NavigationTreeJSON } from '../src/shared/types/tree.js';
import { NavigationTree } from '../src/background/state/nav-tree.js';
import { CommandManager } from '../src/shared/lib/commands.js';

function data(url: string, title?: string): NodeData {
  return {
    url: url as Url,
    title: (title ?? url) as Title,
    pinned: false,
    tags: [],
  };
}

function testNavigationTreeDeletion(): void {
  const tree = new NavigationTree(100);
  const root = tree.navigate(data('https://root.test'));
  const child = tree.navigate(data('https://child.test'));
  tree.setCurrent(root);
  const sibling = tree.navigate(data('https://sibling.test'));
  tree.setCurrent(child);
  const grand = tree.navigate(data('https://grand.test'));

  const removed = tree.deleteNode(child.id);
  assert.equal(removed.length, 1);
  assert.equal(tree.findNodeById(child.id), null);
  assert.equal(tree.findNodeById(grand.id)?.getParent()?.id, root.id);

  const removedChildren = tree.deleteChildren(root.id);
  assert.equal(removedChildren.length, 2);
  assert.equal(tree.findNodeById(sibling.id), null);
  assert.equal(tree.findNodeById(grand.id), null);
  assert.equal(tree.size(), 1);
}

function testNavigationTreeSubtree(): void {
  const tree = new NavigationTree(100);
  const root = tree.navigate(data('https://root.test'));
  const child = tree.navigate(data('https://child.test'));
  const grand = tree.navigate(data('https://grand.test'));

  const removed = tree.deleteSubtree(child.id);
  assert.equal(removed.length, 2);
  assert.equal(tree.findNodeById(child.id), null);
  assert.equal(tree.findNodeById(grand.id), null);
  assert.equal(tree.size(), 1);
  assert.equal(tree.findNodeById(root.id), root);
}

function testCommandManagerUndoRedo(): void {
  CommandManager.clearHistory();

  const rootNode: NavigationNodeJSON = {
    id: 1 as NodeId,
    timestamp: 1 as Timestamp,
    data: data('https://root.test'),
    children: [],
  };

  const snapshot1: NavigationTreeJSON = {
    root: rootNode,
    currentNodeId: rootNode.id,
    capacity: 100,
    nodeCount: 1,
  };

  const childNode: NavigationNodeJSON = {
    id: 2 as NodeId,
    timestamp: 2 as Timestamp,
    data: data('https://child.test'),
    children: [],
  };

  const snapshot2: NavigationTreeJSON = {
    root: {
      ...rootNode,
      children: [childNode],
    },
    currentNodeId: childNode.id,
    capacity: 100,
    nodeCount: 2,
  };

  CommandManager.saveSnapshot(snapshot1, 'snapshot-1' as Description);

  const undoState = CommandManager.undo(snapshot2);
  assert.ok(undoState);
  assert.equal(undoState!.nodeCount, 1);
  assert.equal(undoState!.root?.children.length, 0);

  const redoState = CommandManager.redo(undoState!);
  assert.ok(redoState);
  assert.equal(redoState!.nodeCount, 2);
  assert.equal(redoState!.root?.children.length, 1);
}

try {
  testNavigationTreeDeletion();
  testNavigationTreeSubtree();
  testCommandManagerUndoRedo();
  console.log('All tests passed');
} catch (error) {
  console.error('Test failure:', error);
  process.exit(1);
}
