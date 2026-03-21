import type { NodeId } from "../types/ids.js";
import type { NavigationNode } from "../types/node.js";

// ---------------------------------------------------------------------------
// Scoring constants
// ---------------------------------------------------------------------------

/** Weight for visit frequency in the combined score. */
export const SCORE_FREQ_WEIGHT = 10;
/** Weight for recency bonus in the combined score. */
export const SCORE_RECENCY_WEIGHT = 5;
/** Time window (ms) over which recency bonus decays linearly to 0. */
export const SCORE_RECENCY_DECAY_MS = 2 * 60 * 60 * 1000; // 2 hours

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Compute a combined score from visit count and recency.
 * Frequency dominates for stability; recency gives a gentle nudge.
 */
export function computeNodeScore(visitCount: number, lastVisitedAt: number, now: number): number {
  const freqScore = Math.log2(1 + visitCount) * SCORE_FREQ_WEIGHT;
  const age = now - lastVisitedAt;
  const recencyBonus =
    age <= 0 ? 1 : age >= SCORE_RECENCY_DECAY_MS ? 0 : 1 - age / SCORE_RECENCY_DECAY_MS;
  return freqScore + recencyBonus * SCORE_RECENCY_WEIGHT;
}

// ---------------------------------------------------------------------------
// Subtree score propagation
// ---------------------------------------------------------------------------

/**
 * Walk the tree and compute, for each node, the maximum score across
 * itself and all its descendants. Nodes absent from `nodeScores` are
 * treated as having score 0.
 */
export function computeSubtreeScores(
  root: NavigationNode,
  nodeScores: Record<NodeId, number>,
  getChildren: (node: NavigationNode) => readonly NavigationNode[],
): Map<NodeId, number> {
  const result = new Map<NodeId, number>();

  function walk(node: NavigationNode): number {
    let max = nodeScores[node.id] ?? 0;
    for (const child of getChildren(node)) {
      max = Math.max(max, walk(child));
    }
    result.set(node.id, max);
    return max;
  }

  walk(root);
  return result;
}

/** @deprecated Use computeSubtreeScores instead. Kept for backwards compat. */
export const computeSubtreeRecency = computeSubtreeScores;

// ---------------------------------------------------------------------------
// Initial placement (used only when no previous order exists)
// ---------------------------------------------------------------------------

/**
 * Balanced center-weighted ordering using subtree spans as weights.
 * Only used for initial placement when there's no previous order to preserve.
 */
function balancedCenterOrder<T>(items: T[], getSpan: (item: T) => number): T[] {
  const len = items.length;
  if (len <= 2) return items;

  const result = new Array<T>(len);
  const mid = len >> 1;
  result[mid] = items[0]!;

  let left = mid - 1;
  let right = mid + 1;
  let leftWeight = 0;
  let rightWeight = 0;

  for (let i = 1; i < len; i++) {
    const item = items[i]!;
    const span = getSpan(item);

    if (left < 0) {
      result[right++] = item;
      rightWeight += span;
    } else if (right >= len) {
      result[left--] = item;
      leftWeight += span;
    } else if (leftWeight <= rightWeight) {
      result[left--] = item;
      leftWeight += span;
    } else {
      result[right++] = item;
      rightWeight += span;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Incremental center reorder (for tree/mindmap)
// ---------------------------------------------------------------------------

/**
 * Incrementally reorder children toward the array center.
 *
 * Starts from the previous order and applies cascading inward sweeps.
 * Each sweep direction enables multi-position cascades in a single pass:
 * edge nodes can cascade all the way to center, while center nodes
 * resist displacement (budget = 1, only moved once per call).
 */
export function incrementalCenterReorder(
  children: readonly NavigationNode[],
  scores: Map<NodeId, number>,
  previousOrder: NodeId[] | null | undefined,
  subtreeSpans?: Map<NodeId, number> | null,
): NavigationNode[] {
  if (children.length <= 1) return [...children];

  const childMap = new Map<NodeId, NavigationNode>();
  for (const child of children) {
    childMap.set(child.id, child);
  }

  let current: NavigationNode[];

  if (previousOrder && previousOrder.length > 0) {
    const kept: NavigationNode[] = [];
    const seen = new Set<NodeId>();
    for (const id of previousOrder) {
      const node = childMap.get(id);
      if (node) {
        kept.push(node);
        seen.add(id);
      }
    }

    const newChildren: NavigationNode[] = [];
    for (const child of children) {
      if (!seen.has(child.id)) {
        newChildren.push(child);
      }
    }

    if (newChildren.length > 0) {
      newChildren.sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
      current = [...kept, ...newChildren];
    } else {
      current = kept;
    }
  } else {
    const sorted = [...children].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
    if (children.length === 2) return sorted;
    return balancedCenterOrder(sorted, (node) => subtreeSpans?.get(node.id) ?? 1);
  }

  if (current.length <= 2) {
    current.sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
    return current;
  }

  const len = current.length;
  const centerIdx = len >> 1;

  // Budget from STARTING position: edge nodes get more swaps, center fewer.
  // Pre-computed so budget doesn't shrink as nodes cascade inward.
  const budget = new Map<NodeId, number>();
  for (let i = 0; i < len; i++) {
    budget.set(current[i]!.id, Math.max(1, Math.abs(i - centerIdx)));
  }

  const moveCount = new Map<NodeId, number>();
  const MAX_PASSES = 3;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let swapped = false;

    // Inward sweep from right — cascades right-side high-score nodes toward center
    for (let i = len - 2; i >= 0; i--) {
      const a = current[i]!;
      const b = current[i + 1]!;
      const scoreA = scores.get(a.id) ?? 0;
      const scoreB = scores.get(b.id) ?? 0;
      const distA = Math.abs(i - centerIdx);
      const distB = Math.abs(i + 1 - centerIdx);

      if (scoreB > scoreA && distB >= distA) {
        const movesA = moveCount.get(a.id) ?? 0;
        const movesB = moveCount.get(b.id) ?? 0;
        if (movesA < (budget.get(a.id) ?? 1) && movesB < (budget.get(b.id) ?? 1)) {
          current[i] = b;
          current[i + 1] = a;
          moveCount.set(a.id, movesA + 1);
          moveCount.set(b.id, movesB + 1);
          swapped = true;
        }
      }
    }

    // Inward sweep from left — cascades left-side high-score nodes toward center
    for (let i = 0; i < len - 1; i++) {
      const a = current[i]!;
      const b = current[i + 1]!;
      const scoreA = scores.get(a.id) ?? 0;
      const scoreB = scores.get(b.id) ?? 0;
      const distA = Math.abs(i - centerIdx);
      const distB = Math.abs(i + 1 - centerIdx);

      if (scoreA > scoreB && distA >= distB) {
        const movesA = moveCount.get(a.id) ?? 0;
        const movesB = moveCount.get(b.id) ?? 0;
        if (movesA < (budget.get(a.id) ?? 1) && movesB < (budget.get(b.id) ?? 1)) {
          current[i + 1] = a;
          current[i] = b;
          moveCount.set(a.id, movesA + 1);
          moveCount.set(b.id, movesB + 1);
          swapped = true;
        }
      }
    }

    if (!swapped) break;
  }

  return current;
}

// ---------------------------------------------------------------------------
// Cluster reorder (for radial layout)
// ---------------------------------------------------------------------------

/**
 * Sort children by score descending. Active nodes cluster at the start
 * of the array, which maps to a contiguous arc in radial layout.
 *
 * Signature matches `incrementalCenterReorder` so both can be used
 * interchangeably via `reorderFn` in GraphCanvas.
 */
export function incrementalClusterReorder(
  children: readonly NavigationNode[],
  scores: Map<NodeId, number>,
  _previousOrder?: NodeId[] | null,
  _subtreeSpans?: Map<NodeId, number> | null,
): NavigationNode[] {
  if (children.length <= 1) return [...children];
  return [...children].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
}

// ---------------------------------------------------------------------------
// Public API (backwards compatible signature)
// ---------------------------------------------------------------------------

export type RecencySortV2Options = {
  previousSiblingOrder?: NodeId[] | null | undefined;
};

/**
 * Stable, incremental recency/frequency sort.
 *
 * Uses the previous sibling order as a starting point and applies limited
 * adjacent swaps to move high-scoring children toward the center.
 * This prevents the dramatic position jumps of the old balancedCenterOrder.
 */
export function recencySortChildrenV2(
  children: NavigationNode[],
  subtreeScores: Map<NodeId, number>,
  subtreeSpans?: Map<NodeId, number> | null,
  options?: RecencySortV2Options,
): NavigationNode[] {
  return incrementalCenterReorder(
    children,
    subtreeScores,
    options?.previousSiblingOrder,
    subtreeSpans,
  );
}
