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
};
