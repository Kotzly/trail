import type { NodeId } from '../types/ids.js';
import type { NavigationNode } from '../types/node.js';

/**
 * Walk the tree and compute, for each node, the maximum recency across
 * itself and all its descendants.  Nodes absent from `nodeRecency` are
 * treated as having recency 0 (never accessed).
 */
export function computeSubtreeRecency(
  root: NavigationNode,
  nodeRecency: Record<NodeId, number>,
  getChildren: (node: NavigationNode) => NavigationNode[],
): Map<NodeId, number> {
  const result = new Map<NodeId, number>();

  function walk(node: NavigationNode): number {
    let max = nodeRecency[node.id] ?? 0;
    for (const child of getChildren(node)) {
      max = Math.max(max, walk(child));
    }
    result.set(node.id, max);
    return max;
  }

  walk(root);
  return result;
}

/**
 * Balanced center-weighted ordering using exact subtree spans as weights.
 *
 * 1. Most recent child → center index.
 * 2. Remaining children are placed greedily on the lighter side
 *    (by cumulative span), producing a visually balanced tree.
 *
 * When `subtreeSpans` is absent or all spans are zero, falls back to
 * simple left/right alternation (equal-weight assumption).
 */
function balancedCenterOrder<T>(
  items: T[],
  getSpan: (item: T) => number,
): T[] {
  const len = items.length;
  if (len <= 2) return items;

  const result = new Array<T>(len);
  const mid = len >> 1;

  // First item → center
  result[mid] = items[0]!;

  let left = mid - 1;
  let right = mid + 1;
  let leftWeight = 0;
  let rightWeight = 0;

  for (let i = 1; i < len; i++) {
    const item = items[i]!;
    const span = getSpan(item);

    if (left < 0) {
      // No more room on left
      result[right++] = item;
      rightWeight += span;
    } else if (right >= len) {
      // No more room on right
      result[left--] = item;
      leftWeight += span;
    } else if (leftWeight <= rightWeight) {
      // Left is lighter → place there
      result[left--] = item;
      leftWeight += span;
    } else {
      // Right is lighter → place there
      result[right++] = item;
      rightWeight += span;
    }
  }

  return result;
}

/**
 * Sort children by subtree recency (descending) then apply balanced
 * center-weighted ordering using exact tidy-tree spans.
 *
 * Returns the original array unchanged when there is no meaningful
 * recency data (all zeros) or the list is too short to reorder.
 */
export function spotlightSortChildren(
  children: NavigationNode[],
  subtreeRecency: Map<NodeId, number>,
  subtreeSpans?: Map<NodeId, number> | null,
): NavigationNode[] {
  if (children.length <= 2) return children;

  const hasRecency = children.some((c) => (subtreeRecency.get(c.id) ?? 0) > 0);
  if (!hasRecency) return children;

  const sorted = [...children].sort((a, b) => {
    const ra = subtreeRecency.get(a.id) ?? 0;
    const rb = subtreeRecency.get(b.id) ?? 0;
    return rb - ra;
  });

  return balancedCenterOrder(
    sorted,
    (node) => subtreeSpans?.get(node.id) ?? 1,
  );
}
