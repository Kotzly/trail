import assert from "node:assert/strict";
import {
  EMPTY_TREE_INDEX,
  buildTreeIndex,
  getChildren,
  getNode,
  getParent,
  isRoot,
  iter,
} from "../src/apps/sidepanel/ui/state/tree-index.js";
import { asNodeId, now, type NodeId, type Timestamp, type Title, type Url } from "../src/shared/types/ids.js";
import type { NavigationNodeJSON } from "../src/shared/types/node.js";
import type { NavigationTreeJSON } from "../src/shared/types/tree.js";

let nextId = 0;
function makeId(): NodeId {
  nextId += 1;
  return asNodeId(`n${nextId}`);
}

function n(
  url: string,
  title: string,
  children: NavigationNodeJSON[] = [],
  opts: { pinned?: boolean } = {},
): NavigationNodeJSON {
  return {
    id: makeId(),
    timestamp: now() as Timestamp,
    data: {
      url: url as Url,
      title: title as Title,
      pinned: opts.pinned ?? false,
      tags: [],
    },
    children,
  };
}

function tree(root: NavigationNodeJSON | null, currentNodeId: NodeId | null = null): NavigationTreeJSON {
  let count = 0;
  if (root) {
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop()!;
      count += 1;
      for (const child of node.children) stack.push(child);
    }
  }
  return { root, currentNodeId, nodeCount: count };
}

function testEmptyAndNullPaths(): void {
  nextId = 0;
  assert.equal(EMPTY_TREE_INDEX.size, 0, "EMPTY index size is 0");
  assert.equal(EMPTY_TREE_INDEX.rootId, null);
  assert.equal(EMPTY_TREE_INDEX.currentNodeId, null);

  const emptyJson = tree(null);
  const idx = buildTreeIndex(emptyJson);
  assert.equal(idx.size, 0, "null-root index size is 0");
  assert.equal(idx.rootId, null, "null-root has no rootId");
  assert.equal(getNode(idx, asNodeId("missing")), null);
  assert.deepEqual(Array.from(iter(idx)), []);

  const noneIdx = buildTreeIndex(null);
  assert.equal(noneIdx.size, 0);
  console.log("  empty / null: OK");
}

function testLookups(): void {
  nextId = 0;
  const leafA = n("https://a.example/", "A");
  const leafB = n("https://b.example/", "B");
  const mid = n("https://m.example/", "M", [leafA, leafB]);
  const root = n("chrome://newtab/", "New Tab", [mid]);
  const idx = buildTreeIndex(tree(root, leafB.id));

  assert.equal(idx.size, 4);
  assert.equal(idx.rootId, root.id);
  assert.equal(idx.currentNodeId, leafB.id);

  assert.equal(getNode(idx, leafA.id), leafA, "findNodeById leafA");
  assert.equal(getNode(idx, asNodeId("nope")), null, "missing id returns null");

  assert.equal(getParent(idx, leafA.id), mid, "leafA parent is mid");
  assert.equal(getParent(idx, mid.id), root, "mid parent is root");
  assert.equal(getParent(idx, root.id), null, "root has no parent");

  assert.deepEqual(getChildren(idx, mid.id), [leafA, leafB], "mid children");
  assert.deepEqual(getChildren(idx, leafA.id), [], "leaf has no children");
  assert.deepEqual(getChildren(idx, asNodeId("nope")), [], "missing returns []");

  assert.equal(isRoot(idx, root.id), true);
  assert.equal(isRoot(idx, mid.id), false);
  console.log("  lookups: OK");
}

function testIterIsPreOrderLeftToRight(): void {
  nextId = 0;
  // Tree shape:
  //   R
  //   ├ A
  //   │ ├ A1
  //   │ └ A2
  //   └ B
  //     └ B1
  const a1 = n("https://a1/", "A1");
  const a2 = n("https://a2/", "A2");
  const a = n("https://a/", "A", [a1, a2]);
  const b1 = n("https://b1/", "B1");
  const b = n("https://b/", "B", [b1]);
  const root = n("chrome://newtab/", "R", [a, b]);
  const idx = buildTreeIndex(tree(root));

  const order = Array.from(iter(idx)).map((node) => node.id);
  assert.deepEqual(
    order,
    [root.id, a.id, a1.id, a2.id, b.id, b1.id],
    "iter must yield parent-before-children, left-to-right",
  );
  console.log("  iter pre-order: OK");
}

function testPinnedIndexFollowsIterOrder(): void {
  nextId = 0;
  const a1 = n("https://a1/", "A1", [], { pinned: true });
  const a2 = n("https://a2/", "A2");
  const a = n("https://a/", "A", [a1, a2], { pinned: true });
  const b1 = n("https://b1/", "B1", [], { pinned: true });
  const b = n("https://b/", "B", [b1]);
  const root = n("chrome://newtab/", "R", [a, b]);
  const idx = buildTreeIndex(tree(root));

  // PinnedDropdown's visual order depends on this — pre-order DFS,
  // left-to-right, parent before children.
  assert.deepEqual(
    Array.from(idx.pinnedIndex),
    [a.id, a1.id, b1.id],
    "pinnedIndex preserves pre-order DFS insertion",
  );
  console.log("  pinnedIndex order: OK");
}

function testHandlesDeepChainWithoutStackOverflow(): void {
  nextId = 0;
  // 5k-deep degenerate chain — recursion would blow on some engines.
  // Iterative DFS in buildTreeIndex / iter must handle this.
  let current: NavigationNodeJSON = n("https://leaf/", "leaf");
  const leaf = current;
  for (let i = 0; i < 5000; i += 1) {
    current = n(`https://n${i}/`, `n${i}`, [current]);
  }
  const root = current;
  const idx = buildTreeIndex(tree(root, leaf.id));

  assert.equal(idx.size, 5001);
  assert.equal(idx.rootId, root.id);
  assert.equal(idx.currentNodeId, leaf.id);

  let counted = 0;
  for (const _ of iter(idx)) counted += 1;
  assert.equal(counted, 5001, "iter visits every node in deep chain");
  console.log("  deep chain: OK");
}

function run(): void {
  console.log("Running tree-index.test.ts...");
  testEmptyAndNullPaths();
  testLookups();
  testIterIsPreOrderLeftToRight();
  testPinnedIndexFollowsIterOrder();
  testHandlesDeepChainWithoutStackOverflow();
}

run();
console.log("tree-index.test.ts passed");
