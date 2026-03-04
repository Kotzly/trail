import assert from 'node:assert/strict';
import type { NodeId } from '../src/shared/types/ids.js';
import type { NavigationNode } from '../src/shared/types/node.js';
import {
  computeSubtreeScores,
  computeNodeScore,
  recencySortChildrenV2,
  incrementalCenterReorder,
  SCORE_FREQ_WEIGHT,
  SCORE_RECENCY_WEIGHT,
  SCORE_RECENCY_DECAY_MS,
} from '../src/shared/lib/recency.js';

type TestNode = {
  id: NodeId;
  timestamp: number;
  data: { lastVisitedAt?: number; visitCount?: number };
  _children: TestNode[];
  getChildren: () => TestNode[];
};

function makeNode(id: number, children: TestNode[] = []): TestNode {
  return {
    id: id as NodeId,
    timestamp: id,
    data: {},
    _children: children,
    getChildren() {
      return this._children;
    },
  };
}

function asNav(nodes: TestNode[]): NavigationNode[] {
  return nodes as unknown as NavigationNode[];
}

function ids(nodes: NavigationNode[]): number[] {
  return nodes.map((n) => n.id as number);
}

// ---------------------------------------------------------------------------
// computeSubtreeScores
// ---------------------------------------------------------------------------

function testSubtreeScores(): void {
  const deep = makeNode(31);
  const branchA = makeNode(11, [deep]);
  const branchB = makeNode(12);
  const root = makeNode(1, [branchA, branchB]);
  const nodeScores = {
    [deep.id]: 200,
    [branchB.id]: 100,
  } as Record<NodeId, number>;

  const subtreeScores = computeSubtreeScores(
    root as unknown as NavigationNode,
    nodeScores,
    (node) => (node as unknown as TestNode).getChildren() as unknown as NavigationNode[],
  );

  assert.equal(subtreeScores.get(branchA.id), 200, 'deep leaf score must bubble to parent');
  assert.equal(subtreeScores.get(root.id), 200, 'deep leaf score must bubble to root');
  console.log('  subtreeScores: OK');
}

// ---------------------------------------------------------------------------
// computeNodeScore
// ---------------------------------------------------------------------------

function testNodeScore(): void {
  const now = Date.now();

  // Just visited, 1 visit
  const score1 = computeNodeScore(1, now, now);
  assert(score1 >= SCORE_FREQ_WEIGHT, `single visit just now should be >= FREQ_WEIGHT, got ${score1}`);

  // Visited 20 times, 2+ hours ago
  const score20old = computeNodeScore(20, now - SCORE_RECENCY_DECAY_MS - 1, now);
  assert.equal(score20old, 20 * SCORE_FREQ_WEIGHT, 'expired recency should contribute 0 bonus');

  // 1 visit just now should not beat 20 visits long ago
  assert(score20old > score1, 'frequency should dominate: 20 old visits > 1 fresh visit');

  console.log('  nodeScore: OK');
}

// ---------------------------------------------------------------------------
// incrementalCenterReorder - basic: 2 children sort by score
// ---------------------------------------------------------------------------

function testTwoChildrenSort(): void {
  const a = makeNode(1);
  const b = makeNode(2);
  const scores = new Map<NodeId, number>([[a.id, 50], [b.id, 100]]);

  const result = recencySortChildrenV2(asNav([a, b]), scores);
  assert.equal(result[0]?.id, b.id, '2 children: higher score first');
  console.log('  twoChildren: OK');
}

// ---------------------------------------------------------------------------
// incrementalCenterReorder - initial placement uses balancedCenterOrder
// ---------------------------------------------------------------------------

function testInitialPlacement(): void {
  const nodes = [makeNode(1), makeNode(2), makeNode(3), makeNode(4), makeNode(5)];
  const scores = new Map<NodeId, number>([
    [nodes[0]!.id, 500],
    [nodes[1]!.id, 400],
    [nodes[2]!.id, 300],
    [nodes[3]!.id, 200],
    [nodes[4]!.id, 100],
  ]);

  const result = incrementalCenterReorder(asNav(nodes), scores, null);
  // With no previous order, the highest-score node should be near center
  const centerIdx = result.length >> 1;
  assert.equal(result[centerIdx]?.id, nodes[0]!.id, 'initial: highest score at center');
  console.log('  initialPlacement: OK');
}

// ---------------------------------------------------------------------------
// incrementalCenterReorder - max 1 swap near center
// ---------------------------------------------------------------------------

function testMaxSwapNearCenter(): void {
  // Previous order: [A, B, C, D, E] with C at center
  // Now give E the highest score — it should NOT jump to center in one step
  const nodes = [makeNode(1), makeNode(2), makeNode(3), makeNode(4), makeNode(5)];
  const previousOrder = nodes.map((n) => n.id);

  const scores = new Map<NodeId, number>([
    [nodes[0]!.id, 10],
    [nodes[1]!.id, 20],
    [nodes[2]!.id, 30], // center
    [nodes[3]!.id, 40],
    [nodes[4]!.id, 500], // highest but at edge
  ]);

  const result = incrementalCenterReorder(asNav(nodes), scores, previousOrder);
  const resultIds = ids(result);

  // Node 5 (id=5) was at index 4 (edge). It should NOT teleport to center.
  // Center is index 2. Distance from center at pos 4 is 2, so max 2 swaps.
  // It should move at most 2 positions inward.
  const newIdx = resultIds.indexOf(5);
  const oldIdx = 4;
  const moved = Math.abs(newIdx - oldIdx);
  assert(moved <= 2, `edge node moved ${moved} positions, expected <=2`);

  // Node at center (id=3, index 2, dist=0) should move at most 1
  const centerOld = 2;
  const centerNew = resultIds.indexOf(3);
  const centerMoved = Math.abs(centerNew - centerOld);
  assert(centerMoved <= 1, `center node moved ${centerMoved} positions, expected <=1`);

  console.log('  maxSwapNearCenter: OK');
}

// ---------------------------------------------------------------------------
// incrementalCenterReorder - convergence over multiple iterations
// ---------------------------------------------------------------------------

function testConvergence(): void {
  // Start with reverse order, high score at edge
  const nodes = [makeNode(1), makeNode(2), makeNode(3), makeNode(4), makeNode(5)];
  const scores = new Map<NodeId, number>([
    [nodes[0]!.id, 100],
    [nodes[1]!.id, 200],
    [nodes[2]!.id, 300],
    [nodes[3]!.id, 400],
    [nodes[4]!.id, 500],
  ]);

  // Initial order: node with score 100 at pos 0, score 500 at pos 4
  let order: NodeId[] = nodes.map((n) => n.id);
  let current = asNav(nodes);

  // Run 10 iterations — should converge
  for (let i = 0; i < 10; i++) {
    const result = incrementalCenterReorder(current, scores, order);
    order = result.map((n) => n.id);
    current = result;
  }

  // After convergence, highest score should be near center
  const centerIdx = order.length >> 1;
  assert.equal(order[centerIdx], nodes[4]!.id, 'after convergence: highest score at center');
  console.log('  convergence: OK');
}

// ---------------------------------------------------------------------------
// incrementalCenterReorder - handles removed and added children
// ---------------------------------------------------------------------------

function testAddRemoveChildren(): void {
  const a = makeNode(1);
  const b = makeNode(2);
  const c = makeNode(3);
  const d = makeNode(4); // new child

  const previousOrder = [a.id, b.id, c.id];
  const scores = new Map<NodeId, number>([
    [a.id, 100],
    // b removed
    [c.id, 200],
    [d.id, 50],
  ]);

  const result = incrementalCenterReorder(asNav([a, c, d]), scores, previousOrder);
  const resultIds = ids(result);

  // b should be gone, d should appear
  assert(!resultIds.includes(2), 'removed child should not appear');
  assert(resultIds.includes(4), 'new child should appear');
  assert.equal(resultIds.length, 3, 'result should have exactly 3 children');
  console.log('  addRemoveChildren: OK');
}

// ---------------------------------------------------------------------------
// incrementalCenterReorder - equal scores preserve order
// ---------------------------------------------------------------------------

function testEqualScoresPreserveOrder(): void {
  const nodes = [makeNode(1), makeNode(2), makeNode(3), makeNode(4)];
  const previousOrder = nodes.map((n) => n.id);
  const scores = new Map<NodeId, number>([
    [nodes[0]!.id, 100],
    [nodes[1]!.id, 100],
    [nodes[2]!.id, 100],
    [nodes[3]!.id, 100],
  ]);

  const result = incrementalCenterReorder(asNav(nodes), scores, previousOrder);
  assert.deepEqual(ids(result), ids(asNav(nodes)), 'equal scores should preserve previous order');
  console.log('  equalScores: OK');
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------

function run(): void {
  console.log('Running basic.test.ts...');
  testSubtreeScores();
  testNodeScore();
  testTwoChildrenSort();
  testInitialPlacement();
  testMaxSwapNearCenter();
  testConvergence();
  testAddRemoveChildren();
  testEqualScoresPreserveOrder();
}

run();
console.log('basic.test.ts: ALL PASSED');
