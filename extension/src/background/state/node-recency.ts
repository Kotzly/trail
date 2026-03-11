import type { NodeId, Timestamp } from '@shared/types/ids.js';
import { updateNodeData } from '@shared/types/node.js';
import type { NavigationTree } from './nav-tree.js';

/**
 * Persist the last active visit timestamp and increment visit count for a node.
 * Returns true when the node data was updated.
 */
export function markNodeVisited(
  tree: NavigationTree,
  nodeId: NodeId,
  at?: number,
): boolean {
  const node = tree.findNodeById(nodeId);
  if (!node) return false;

  const nextAtRaw = typeof at === 'number' && Number.isFinite(at) ? Math.floor(at) : Date.now();
  const prevAtRaw =
    typeof node.data.lastVisitedAt === 'number' && Number.isFinite(node.data.lastVisitedAt)
      ? Number(node.data.lastVisitedAt)
      : Number(node.timestamp);

  if (!Number.isFinite(nextAtRaw) || nextAtRaw <= prevAtRaw) {
    return false;
  }

  const prevCount = typeof node.data.visitCount === 'number' ? node.data.visitCount : 0;
  node.data = updateNodeData(node.data, {
    lastVisitedAt: nextAtRaw as Timestamp,
    visitCount: prevCount + 1,
  });
  return true;
}
