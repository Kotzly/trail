import type { NavigationTreeJSON } from '@shared/types/tree.js';
import type { Settings } from '@shared/types/settings.js';
import type { NodePosition } from '@entrypoints/sidepanel/ui/graph/types.js';
import { NavigationTreeMapper } from '@shared/lib/mapper.js';
import {
  calculateLayout,
  calculateMindmapLayout,
  calculateRadialLayout,
  getCanvasBounds,
} from '@entrypoints/sidepanel/ui/graph/layout/calculator.js';
import { deriveLayoutOptions } from '@entrypoints/sidepanel/ui/graph/layout/options.js';
import type { CachedLayoutResult, CachedNodePosition } from './types.js';
import type { NodeId } from '@shared/types/ids.js';

// ---------------------------------------------------------------------------
// Pure layout computation from serialized tree data
// ---------------------------------------------------------------------------

export function computeLayoutFromTree(
  treeJSON: NavigationTreeJSON,
  treeId: string,
  settings: Settings | null,
): CachedLayoutResult | null {
  const tree = NavigationTreeMapper.fromJSON(treeJSON);
  const root = tree.getRoot();
  if (!root) return null;

  const options = deriveLayoutOptions(settings);

  // Compute layout using default child ordering (no recency reordering —
  // that requires stateful refs from GraphCanvas, which we skip here).
  let result: { positions: Map<NodeId, NodePosition>; width: number };

  switch (options.mode) {
    case 'tree':
      result = calculateLayout(root, options.tree);
      break;
    case 'mindmap':
      result = calculateMindmapLayout(root, options.mindmap);
      break;
    default:
      result = calculateRadialLayout(root, options.radial, options.tree);
      break;
  }

  // Serialize positions — strip `node` refs, keep only coordinates
  const positions: Record<NodeId, CachedNodePosition> = {};
  let nodeCount = 0;
  for (const [id, pos] of result.positions) {
    positions[id] = { x: pos.x, y: pos.y };
    nodeCount++;
  }

  const bounds = getCanvasBounds(result.positions, options.tree.nodeWidth, options.tree.nodeHeight);

  return {
    treeId,
    nodeCount,
    layoutMode: options.mode,
    timestamp: Date.now(),
    positions,
    bounds: { minX: bounds.minX, minY: bounds.minY, maxX: bounds.maxX, maxY: bounds.maxY },
    width: result.width,
  };
}
