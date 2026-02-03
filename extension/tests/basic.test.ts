import assert from 'node:assert/strict';

import type { NodeData, NavigationNodeJSON } from '../src/shared/types/node.js';
import type { Description, NodeId, Timestamp, Url, Title } from '../src/shared/types/ids.js';
import type { NavigationTreeJSON } from '../src/shared/types/tree.js';
import { NavigationTree } from '../src/background/state/nav-tree.js';
import { CommandManager } from '../src/shared/lib/commands.js';
import type { LayoutConfig, RadialLayoutConfig } from '../src/sidepanel/ui/graph/types.js';
import type { ViewState } from '../src/sidepanel/ui/graph/types.js';
import {
  calculateLayout,
  calculateMindmapLayout,
  calculateRadialLayout,
  getCanvasBounds,
} from '../src/sidepanel/ui/graph/layout/calculator.js';
import { computeGraphGridTransform } from '../src/sidepanel/ui/components/graph/grid-transform.js';
import { getSidebarLabelState, getSidebarWidth } from '../src/sidepanel/ui/components/ui/sidebar-utils.js';

function data(url: Url, title?: Title): NodeData {
  return {
    url,
    title: (title ?? url) as Title,
    pinned: false,
    tags: [],
  };
}

function testNavigationTreeDeletion(): void {
  const tree = new NavigationTree(100);
  const root = tree.navigate(data('https://root.test' as Url));
  const child = tree.navigate(data('https://child.test' as Url));
  tree.setCurrent(root);
  const sibling = tree.navigate(data('https://sibling.test' as Url));
  tree.setCurrent(child);
  const grand = tree.navigate(data('https://grand.test' as Url));

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
  const root = tree.navigate(data('https://root.test' as Url));
  const child = tree.navigate(data('https://child.test' as Url));
  const grand = tree.navigate(data('https://grand.test' as Url));

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

function testNavigationTreeSearchIndex(): void {
  const tree = new NavigationTree(100);
  const root = tree.navigate(data('https://example.com/root' as Url, 'Root Page' as Title));
  const child = tree.navigate(data('https://docs.example.com/guide' as Url, 'Guide' as Title));
  tree.setCurrent(root);
  const other = tree.navigate(data('https://other.test/path' as Url, 'Other Site' as Title));

  const titleMatches = tree.findNodesByQuery('guide');
  assert.ok(titleMatches.includes(child.id));

  const domainMatches = tree.findNodesByQuery('example.com');
  assert.ok(domainMatches.includes(root.id));
  assert.ok(domainMatches.includes(child.id));

  const multiTermMatches = tree.findNodesByQuery('other path');
  assert.equal(multiTermMatches.length, 1);
  assert.ok(multiTermMatches.includes(other.id));

  const updated = tree.navigate(data('https://other.test/path', 'Renamed'));
  const renameMatches = tree.findNodesByQuery('renamed');
  assert.ok(renameMatches.includes(updated.id));
}

function testGraphLayouts(): void {
  const tree = new NavigationTree(100);
  const root = tree.navigate(data('https://root.test'));
  const child = tree.navigate(data('https://child.test'));
  tree.setCurrent(root);
  const sibling = tree.navigate(data('https://sibling.test'));

  const layoutConfig: LayoutConfig = {
    nodeWidth: 120,
    nodeHeight: 60,
    verticalGap: 40,
    horizontalGap: 20,
  };
  const radialConfig: RadialLayoutConfig = {
    angleWeightExp: 0.6,
    minSpanFactor: 0.6,
    minSpanAbs: 0.12,
    requiredScale: 0.6,
    depthGapBase: 70,
    depthGapGrowth: 0.1,
    effectiveWidth: layoutConfig.nodeWidth + layoutConfig.horizontalGap,
  };

  const treeLayout = calculateLayout(root, layoutConfig);
  assert.equal(treeLayout.positions.size, 3);
  const treeBounds = getCanvasBounds(treeLayout.positions, layoutConfig.nodeWidth, layoutConfig.nodeHeight);
  assert.ok(treeBounds.width >= layoutConfig.nodeWidth);
  assert.ok(treeBounds.height >= layoutConfig.nodeHeight);

  const mindmapLayout = calculateMindmapLayout(root, layoutConfig);
  assert.equal(mindmapLayout.positions.size, 3);

  const radialLayout = calculateRadialLayout(root, radialConfig, layoutConfig);
  assert.equal(radialLayout.positions.size, 3);
  assert.ok(radialLayout.width > 0);
}

function testGraphGridTransform(): void {
  const baseView: ViewState = { translateX: 0, translateY: 0, scale: 1 };
  const base = computeGraphGridTransform(baseView);
  assert.equal(base.size, 20);
  assert.equal(base.dotSize, 1.5);
  assert.equal(base.offsetX, 0);
  assert.equal(base.offsetY, 0);

  const movedView: ViewState = { translateX: 25, translateY: -5, scale: 2 };
  const moved = computeGraphGridTransform(movedView);
  assert.equal(moved.size, 40);
  assert.equal(moved.dotSize, 3);
  assert.equal(moved.offsetX, 25);
  assert.equal(moved.offsetY, 35);

  const tinyView: ViewState = { translateX: 0, translateY: 0, scale: 0.2 };
  const tiny = computeGraphGridTransform(tinyView);
  assert.equal(tiny.size, 16);
  assert.equal(tiny.dotSize, 1);
}

function testSidebarLabelState(): void {
  const openState = getSidebarLabelState(true, true);
  assert.equal(openState.display, 'inline-block');
  assert.equal(openState.opacity, 1);

  const closedState = getSidebarLabelState(false, true);
  assert.equal(closedState.display, 'none');
  assert.equal(closedState.opacity, 0);

  const staticState = getSidebarLabelState(false, false);
  assert.equal(staticState.display, 'inline-block');
  assert.equal(staticState.opacity, 1);
}

function testSidebarWidth(): void {
  assert.equal(getSidebarWidth(true, true), '180px');
  assert.equal(getSidebarWidth(false, true), '72px');
  assert.equal(getSidebarWidth(false, false), '180px');
}

try {
  testNavigationTreeDeletion();
  testNavigationTreeSubtree();
  testCommandManagerUndoRedo();
  testNavigationTreeSearchIndex();
  testGraphLayouts();
  testGraphGridTransform();
  testSidebarLabelState();
  testSidebarWidth();
  console.log('All tests passed');
} catch (error) {
  console.error('Test failure:', error);
  process.exit(1);
}
