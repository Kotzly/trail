import type { NodeId } from '@shared/types/ids.js';

// ---------------------------------------------------------------------------
// Cached layout positions — stored in chrome.storage.session
// ---------------------------------------------------------------------------

export type CachedNodePosition = {
  readonly x: number;
  readonly y: number;
};

export type CachedLayoutBounds = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

export type CachedLayoutResult = {
  readonly treeId: string;
  readonly nodeCount: number;
  readonly layoutMode: string;
  readonly timestamp: number;
  readonly positions: Record<NodeId, CachedNodePosition>;
  readonly bounds: CachedLayoutBounds;
  readonly width: number;
  /** Sorted, comma-joined string of collapsed node IDs. Empty string = nothing collapsed. */
  readonly collapseSignature: string;
  /** Whether recency ordering was active when layout was computed. */
  readonly recencyOrdering: boolean;
};

// ---------------------------------------------------------------------------
// Collapse state signature — deterministic string from collapsed node IDs
// ---------------------------------------------------------------------------

/**
 * Produces a deterministic string from any Set/Array of collapsed node IDs.
 * Sorting ensures the same set always produces the same signature regardless
 * of insertion order.
 */
export function computeCollapseSignature(collapsedNodeIds: Iterable<NodeId>): string {
  const ids = [...collapsedNodeIds];
  ids.sort((a, b) => a - b);
  return ids.join(',');
}
