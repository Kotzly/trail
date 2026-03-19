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
  /** Deterministic signature encoding all settings that affect node positions. */
  readonly layoutSignature: string;
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

// ---------------------------------------------------------------------------
// Layout signature — deterministic hash of all settings affecting positions
// ---------------------------------------------------------------------------

export type LayoutSignatureParams = {
  readonly mode: string;
  readonly density: string;
  readonly tree: { readonly verticalGapScale: number; readonly horizontalGapScale: number };
  readonly mindmap: { readonly verticalGapScale: number; readonly horizontalGapScale: number };
  readonly radial: {
    readonly angleWeightExp: number;
    readonly minSpanFactor: number;
    readonly minSpanAbs: number;
    readonly requiredScale: number;
    readonly depthGapBase: number;
    readonly depthGapGrowth: number;
  };
  readonly collapseSignature: string;
  readonly recencyOrdering: boolean;
};

/**
 * Produces a deterministic string from all layout settings that affect node
 * positions. Two identical param sets always produce the same signature;
 * any difference in mode, density, gap scales, radial params, collapse state,
 * or recency ordering produces a different one.
 */
export function computeLayoutSignature(params: LayoutSignatureParams): string {
  const { mode, density, tree, mindmap, radial, collapseSignature, recencyOrdering } = params;
  return [
    mode,
    density,
    `t:${tree.verticalGapScale},${tree.horizontalGapScale}`,
    `m:${mindmap.verticalGapScale},${mindmap.horizontalGapScale}`,
    `r:${radial.angleWeightExp},${radial.minSpanFactor},${radial.minSpanAbs},${radial.requiredScale},${radial.depthGapBase},${radial.depthGapGrowth}`,
    `c:${collapseSignature}`,
    `o:${recencyOrdering ? '1' : '0'}`,
  ].join('|');
}
