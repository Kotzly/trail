/**
 * Cascade-count contract test for delete-targets (post-migration).
 *
 * Specifically verifies that `countOpenTabsForDelete` correctly walks
 * a TreeIndex (where children come off the JSON node, not a method).
 * The existing delete-flow.test.ts already covers
 * `countDeletedForIntent` / `resolveDeleteTarget` — this file fills
 * the open-tab counting gap.
 */
import assert from "node:assert/strict";
import {
  countOpenTabsForDelete,
  getIncludedRootId,
} from "../src/apps/sidepanel/ui/shared/delete-tree.js";
import { buildTreeIndex } from "../src/apps/sidepanel/ui/state/tree-index.js";
import {
  asNodeId,
  now,
  type NodeId,
  type Timestamp,
  type Title,
  type Url,
} from "../src/shared/types/ids.js";
import type { NavigationNodeJSON } from "../src/shared/types/node.js";
import type { NavigationTreeJSON } from "../src/shared/types/tree.js";

let nextId = 0;
function id(): NodeId {
  nextId += 1;
  return asNodeId(`n${nextId}`);
}

function n(url: string, title: string, children: NavigationNodeJSON[] = []): NavigationNodeJSON {
  return {
    id: id(),
    timestamp: now() as Timestamp,
    data: {
      url: url as Url,
      title: title as Title,
      pinned: false,
      tags: [],
    },
    children,
  };
}

function tree(root: NavigationNodeJSON): NavigationTreeJSON {
  let count = 0;
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    count += 1;
    for (const child of node.children) stack.push(child);
  }
  return { root, currentNodeId: null, nodeCount: count };
}

function testGetIncludedRootIdHit(): void {
  nextId = 0;
  const child = n("https://c/", "C");
  const root = n("chrome://newtab/", "Root", [child]);
  const idx = buildTreeIndex(tree(root));
  assert.equal(getIncludedRootId(idx, [child.id, root.id]), root.id);
  console.log("  getIncludedRootId hit: OK");
}

function testGetIncludedRootIdMiss(): void {
  nextId = 0;
  const child = n("https://c/", "C");
  const root = n("chrome://newtab/", "Root", [child]);
  const idx = buildTreeIndex(tree(root));
  assert.equal(getIncludedRootId(idx, [child.id]), null);
  console.log("  getIncludedRootId miss: OK");
}

function testCountTabsScopeSelf(): void {
  nextId = 0;
  const c1 = n("https://c1/", "C1");
  const c2 = n("https://c2/", "C2");
  const root = n("chrome://newtab/", "R", [c1, c2]);
  const idx = buildTreeIndex(tree(root));
  const counts: Record<NodeId, number> = {
    [c1.id]: 3,
    [c2.id]: 2,
    [root.id]: 1,
  };
  // Only counts the node itself, not children
  assert.equal(countOpenTabsForDelete(idx, [c1.id], counts, "self"), 3);
  console.log("  scope=self: OK");
}

function testCountTabsScopeChildren(): void {
  nextId = 0;
  const c1 = n("https://c1/", "C1");
  const c2 = n("https://c2/", "C2");
  const root = n("chrome://newtab/", "R", [c1, c2]);
  const idx = buildTreeIndex(tree(root));
  const counts: Record<NodeId, number> = {
    [c1.id]: 3,
    [c2.id]: 2,
    [root.id]: 1,
  };
  // Counts children's tabs only, not the node itself.
  assert.equal(countOpenTabsForDelete(idx, [root.id], counts, "children"), 5);
  console.log("  scope=children: OK");
}

function testCountTabsScopeSubtree(): void {
  nextId = 0;
  const grand = n("https://g/", "G");
  const c1 = n("https://c1/", "C1", [grand]);
  const c2 = n("https://c2/", "C2");
  const root = n("chrome://newtab/", "R", [c1, c2]);
  const idx = buildTreeIndex(tree(root));
  const counts: Record<NodeId, number> = {
    [grand.id]: 4,
    [c1.id]: 3,
    [c2.id]: 2,
    [root.id]: 1,
  };
  // subtree from c1 = c1 + grandchild = 3 + 4
  assert.equal(countOpenTabsForDelete(idx, [c1.id], counts, "subtree"), 7);
  // subtree from root = everything
  assert.equal(countOpenTabsForDelete(idx, [root.id], counts, "subtree"), 10);
  console.log("  scope=subtree: OK");
}

function testCountTabsDedup(): void {
  nextId = 0;
  const c1 = n("https://c1/", "C1");
  const root = n("chrome://newtab/", "R", [c1]);
  const idx = buildTreeIndex(tree(root));
  const counts: Record<NodeId, number> = { [c1.id]: 5, [root.id]: 1 };
  // Asking twice doesn't double-count
  assert.equal(countOpenTabsForDelete(idx, [c1.id, c1.id], counts, "self"), 5);
  console.log("  dedup: OK");
}

function run(): void {
  console.log("Running delete-targets.test.ts...");
  testGetIncludedRootIdHit();
  testGetIncludedRootIdMiss();
  testCountTabsScopeSelf();
  testCountTabsScopeChildren();
  testCountTabsScopeSubtree();
  testCountTabsDedup();
}

run();
console.log("delete-targets.test.ts passed");
