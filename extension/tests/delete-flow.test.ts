/**
 * Delete-flow unit tests — collapsed-aware promotion + count math.
 *
 * Scope: pure-function logic in `delete-targets.ts`. The sync-engine
 * queue-dedup and pull-side propagation are tested via the existing
 * conflict/integration tests + manual two-device verification.
 */
import assert from "node:assert/strict";
import type { NodeId } from "../src/shared/types/ids.js";
import {
  countDeletedForIntent,
  resolveDeleteTarget,
} from "../src/apps/sidepanel/ui/shared/delete-targets.js";

// Minimal NavigationTree-like stub. countDeletedForIntent only calls
// `findNodeById` and `getChildren` so we don't need the real class.
type StubNode = {
  id: NodeId;
  getChildren: () => StubNode[];
};

function tree(map: Record<string, string[]>) {
  const nodes = new Map<NodeId, StubNode>();
  for (const id of Object.keys(map)) {
    nodes.set(id as NodeId, {
      id: id as NodeId,
      getChildren: () => (map[id] ?? []).map((cid) => nodes.get(cid as NodeId)!),
    });
  }
  return {
    findNodeById: (id: NodeId) => nodes.get(id) ?? null,
  } as unknown as Parameters<typeof countDeletedForIntent>[0];
}

function testResolvePassesThroughNonNode(): void {
  const out = resolveDeleteTarget({ kind: "tree", treeId: "T1" }, new Set());
  assert.equal(out.kind, "tree");
  assert.deepEqual(out, { kind: "tree", treeId: "T1" });
}

function testResolveExplicitRecursiveStaysRecursive(): void {
  const out = resolveDeleteTarget(
    { kind: "node", nodeIds: ["a" as NodeId], recursive: true },
    new Set(),
  );
  assert.equal(out.kind, "node");
  if (out.kind !== "node") return;
  assert.equal(out.recursive, true);
  assert.equal(out.promotedFromCollapsed, false);
}

function testResolveNonRecursiveNoneCollapsed(): void {
  const out = resolveDeleteTarget(
    { kind: "node", nodeIds: ["a" as NodeId, "b" as NodeId], recursive: false },
    new Set(),
  );
  assert.equal(out.kind, "node");
  if (out.kind !== "node") return;
  assert.equal(out.recursive, false);
  assert.equal(out.promotedFromCollapsed, false);
}

function testResolvePromotesWhenAnyCollapsed(): void {
  const out = resolveDeleteTarget(
    { kind: "node", nodeIds: ["a" as NodeId, "b" as NodeId], recursive: false },
    new Set(["b" as NodeId]),
  );
  assert.equal(out.kind, "node");
  if (out.kind !== "node") return;
  assert.equal(out.recursive, true);
  assert.equal(out.promotedFromCollapsed, true);
}

function testCountFlatNoChildren(): void {
  const t = tree({ a: [], b: [], c: [] });
  const counts = countDeletedForIntent(t, {
    kind: "node",
    nodeIds: ["a" as NodeId, "b" as NodeId],
    recursive: false,
    promotedFromCollapsed: false,
  });
  assert.deepEqual(counts, { direct: 2, hidden: 0 });
}

function testCountSubtreeWithDescendants(): void {
  const t = tree({
    a: ["a1", "a2"],
    a1: ["a1a"],
    a1a: [],
    a2: [],
  });
  const counts = countDeletedForIntent(t, {
    kind: "node",
    nodeIds: ["a" as NodeId],
    recursive: true,
    promotedFromCollapsed: false,
  });
  // direct = 1 (the root of the subtree we asked to delete)
  // hidden = 3 (a1, a1a, a2)
  assert.deepEqual(counts, { direct: 1, hidden: 3 });
}

function testCountSubtreeMultipleRoots(): void {
  const t = tree({
    a: ["a1"],
    a1: [],
    b: ["b1", "b2"],
    b1: [],
    b2: [],
  });
  const counts = countDeletedForIntent(t, {
    kind: "node",
    nodeIds: ["a" as NodeId, "b" as NodeId],
    recursive: true,
    promotedFromCollapsed: false,
  });
  // direct = 2 (a + b — both subtree roots)
  // hidden = 3 (a1, b1, b2)
  assert.deepEqual(counts, { direct: 2, hidden: 3 });
}

function testCountSubtreeDedupsOverlapping(): void {
  // If parent and child are both in nodeIds, we still count each node
  // once thanks to the visited Set inside countDeletedForIntent.
  const t = tree({ a: ["a1"], a1: [] });
  const counts = countDeletedForIntent(t, {
    kind: "node",
    nodeIds: ["a" as NodeId, "a1" as NodeId],
    recursive: true,
    promotedFromCollapsed: false,
  });
  // a is added first (direct=1, then a1 added under it as hidden=1).
  // The second pass with a1 as a "root" hits visited.has(a1) — skip.
  assert.deepEqual(counts, { direct: 1, hidden: 1 });
}

function testCountTreeKindReturnsZero(): void {
  const t = tree({ a: [] });
  const counts = countDeletedForIntent(t, { kind: "tree", treeId: "T1" });
  assert.deepEqual(counts, { direct: 0, hidden: 0 });
}

function run(): void {
  console.log("Running delete-flow.test.ts...");
  testResolvePassesThroughNonNode();
  testResolveExplicitRecursiveStaysRecursive();
  testResolveNonRecursiveNoneCollapsed();
  testResolvePromotesWhenAnyCollapsed();
  testCountFlatNoChildren();
  testCountSubtreeWithDescendants();
  testCountSubtreeMultipleRoots();
  testCountSubtreeDedupsOverlapping();
  testCountTreeKindReturnsZero();
}

run();
console.log("delete-flow.test.ts: ALL PASSED");
