import type { NodeId } from "@shared/types/ids.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RestoreEntry = {
  nodeId: NodeId;
  priority: number; // lower = higher priority (0 = current, 1 = hover, etc.)
  distance: number; // euclidean distance to viewport center (used for sub-sort)
};

/** Minimal subset of NodeRenderModel used for priority scoring. */
export type RestoreScoringModel = {
  isCurrent: boolean;
  isHoverFocused: boolean;
  isSearchFocused: boolean;
  x: number;
  y: number;
};

// ---------------------------------------------------------------------------
// Priority scoring
// ---------------------------------------------------------------------------

/**
 * Compute the restore priority for a single node.
 *
 * Priority tiers (lower = restored first):
 *   0 = current node
 *   1 = hover-focused node
 *   2 = selected node
 *   3 = search-focused node
 *   4 = path node
 *   5 = near viewport center (within median distance)
 *   6 = far from viewport center
 *
 * The returned `priority` value is the tier number. Distance is always
 * computed so callers can sub-sort within the same tier.
 */
export function computeRestorePriority(
  nodeId: NodeId,
  model: RestoreScoringModel,
  viewportCenter: { x: number; y: number },
  selectedIds: ReadonlySet<NodeId> | null,
  searchFocusedId: NodeId | null,
  pathNodeIds: ReadonlySet<NodeId> | null,
): { priority: number; distance: number } {
  const dx = model.x - viewportCenter.x;
  const dy = model.y - viewportCenter.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (model.isCurrent) return { priority: 0, distance };
  if (model.isHoverFocused) return { priority: 1, distance };
  if (selectedIds?.has(nodeId)) return { priority: 2, distance };
  if (model.isSearchFocused || nodeId === searchFocusedId)
    return { priority: 3, distance };
  if (pathNodeIds?.has(nodeId)) return { priority: 4, distance };

  // Tier 5 vs 6 is resolved after all entries are scored — see sortRestoreQueue
  return { priority: 5, distance };
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

/**
 * Returns a NEW sorted array (does NOT mutate input).
 *
 * 1. Entries with priority 5 are split into "near" (5) and "far" (6) using
 *    the median distance of all priority-5 entries as the threshold.
 * 2. Sort ascending by priority, then ascending by distance within the same
 *    priority tier.
 */
export function sortRestoreQueue(entries: readonly RestoreEntry[]): RestoreEntry[] {
  if (entries.length === 0) return [];

  // Collect distances for tier-5 entries to compute median split
  const tier5Distances: number[] = [];
  for (const e of entries) {
    if (e.priority === 5) tier5Distances.push(e.distance);
  }

  let medianDistance = Infinity;
  if (tier5Distances.length > 0) {
    tier5Distances.sort((a, b) => a - b);
    const mid = tier5Distances.length >> 1;
    medianDistance =
      tier5Distances.length % 2 === 0
        ? (tier5Distances[mid - 1]! + tier5Distances[mid]!) / 2
        : tier5Distances[mid]!;
  }

  // Create a copy with resolved tier-5/6 priorities
  const resolved = entries.map((e) => {
    if (e.priority !== 5) return e;
    return e.distance <= medianDistance
      ? e // stays at 5 (near)
      : { ...e, priority: 6 }; // promoted to 6 (far)
  });

  return resolved.slice().sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.distance - b.distance;
  });
}

// ---------------------------------------------------------------------------
// Batch budget
// ---------------------------------------------------------------------------

/**
 * Compute how many nodes to hydrate per idle callback and the minimum
 * remaining idle-time threshold before yielding.
 *
 * Every tree size uses the budgeted path — small trees simply get a larger
 * per-batch budget.
 */
export function computeBatchBudget(totalNodeCount: number): {
  batchSize: number;
  deadlineMs: number;
} {
  if (totalNodeCount < 500) return { batchSize: 60, deadlineMs: 8 };
  if (totalNodeCount < 1500) return { batchSize: 30, deadlineMs: 6 };
  return { batchSize: 15, deadlineMs: 4 };
}
