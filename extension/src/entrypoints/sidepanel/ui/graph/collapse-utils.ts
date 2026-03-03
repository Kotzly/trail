import type { NavigationTree } from '@background/state/nav-tree.js';
import type { NodeId } from '@shared/types/ids.js';

export function getNearestCollapsedAncestorId(
  tree: NavigationTree | null,
  nodeId: NodeId | null,
  collapsedNodeIds: Set<NodeId>
): NodeId | null {
  if (!tree || nodeId === null) return null;
  let current = tree.findNodeById(nodeId);
  if (!current) return null;
  let parent = current.getParent?.() ?? null;
  while (parent) {
    if (collapsedNodeIds.has(parent.id)) return parent.id;
    parent = parent.getParent?.() ?? null;
  }
  return null;
}

export function getCollapsedAncestorIds(
  tree: NavigationTree | null,
  nodeId: NodeId | null,
  collapsedNodeIds: Set<NodeId>
): NodeId[] {
  if (!tree || nodeId === null) return [];
  let current = tree.findNodeById(nodeId);
  if (!current) return [];
  const ancestors: NodeId[] = [];
  let parent = current.getParent?.() ?? null;
  while (parent) {
    if (collapsedNodeIds.has(parent.id)) ancestors.push(parent.id);
    parent = parent.getParent?.() ?? null;
  }
  return ancestors;
}
