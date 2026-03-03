import type { NodeId } from '../../../../../shared/types/ids.js';
import type { NavigationNode } from '../../../../../shared/types/node.js';
import type { LayoutMode, NodePosition } from '../../graph/types.js';
import type { ConnectionSegment } from '../../graph/render/types.js';

export function getPathToNode(root: NavigationNode, targetId: NodeId): Set<NodeId> {
  const path = new Set<NodeId>();
  const findPath = (node: NavigationNode | null): boolean => {
    if (!node) return false;
    path.add(node.id);
    if (node.id === targetId) return true;
    for (const child of node.getChildren()) {
      if (findPath(child)) return true;
    }
    path.delete(node.id);
    return false;
  };
  findPath(root);
  return path;
}

export function getPathBetweenNodes(
  start: NavigationNode | null,
  end: NavigationNode | null,
): Set<NodeId> {
  if (!start || !end) return new Set();
  if (start.id === end.id) return new Set([start.id]);
  const startAncestors = new Map<NodeId, NavigationNode>();
  let current: NavigationNode | null = start;
  while (current) {
    startAncestors.set(current.id, current);
    current = current.getParent?.() ?? null;
  }
  const endPath: NavigationNode[] = [];
  current = end;
  let lca: NavigationNode | null = null;
  while (current) {
    if (startAncestors.has(current.id)) {
      lca = current;
      break;
    }
    endPath.push(current);
    current = current.getParent?.() ?? null;
  }
  if (!lca) return new Set([start.id, end.id]);
  const ids = new Set<NodeId>();
  current = start;
  while (current) {
    ids.add(current.id);
    if (current.id === lca.id) break;
    current = current.getParent?.() ?? null;
  }
  endPath.forEach((node) => ids.add(node.id));
  return ids;
}

export function buildConnections(
  root: NavigationNode | null,
  positions: Map<NodeId, NodePosition>,
  pathNodeIds: Set<NodeId> | null,
  layoutMode: LayoutMode,
  hideRoot: boolean,
  nodeWidth: number,
  nodeHeight: number,
): ConnectionSegment[] {
  if (!root) return [];
  const list: ConnectionSegment[] = [];
  const traverse = (node: NavigationNode | null) => {
    if (!node) return;
    const parentPos = positions.get(node.id);
    if (!parentPos) return;
    node.getChildren().forEach((child) => {
      const childPos = positions.get(child.id);
      if (!childPos) return;
      let startX: number;
      let startY: number;
      let endX: number;
      let endY: number;
      if (layoutMode === 'tree') {
        startX = parentPos.x + nodeWidth / 2;
        startY = parentPos.y + nodeHeight;
        endX = childPos.x + nodeWidth / 2;
        endY = childPos.y;
      } else if (layoutMode === 'mindmap') {
        const childOnRight = childPos.x >= parentPos.x;
        startX = parentPos.x + (childOnRight ? nodeWidth : 0);
        startY = parentPos.y + nodeHeight / 2;
        endX = childPos.x + (childOnRight ? 0 : nodeWidth);
        endY = childPos.y + nodeHeight / 2;
      } else {
        startX = parentPos.x + nodeWidth / 2;
        startY = parentPos.y + nodeHeight / 2;
        endX = childPos.x + nodeWidth / 2;
        endY = childPos.y + nodeHeight / 2;
      }
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      let cp1: { x: number; y: number };
      let cp2: { x: number; y: number };
      if (layoutMode === 'tree') {
        cp1 = { x: startX, y: midY };
        cp2 = { x: endX, y: midY };
      } else if (layoutMode === 'mindmap') {
        cp1 = { x: midX, y: startY };
        cp2 = { x: midX, y: endY };
      } else {
        cp1 = { x: midX, y: startY };
        cp2 = { x: midX, y: endY };
      }
      const onPath =
        pathNodeIds ? pathNodeIds.has(node.id) && pathNodeIds.has(child.id) : false;
      const hideConnection = layoutMode === 'tree' && hideRoot && node.isRoot();
      if (!hideConnection) {
        const bounds = {
          minX: Math.min(startX, endX, cp1.x, cp2.x),
          minY: Math.min(startY, endY, cp1.y, cp2.y),
          maxX: Math.max(startX, endX, cp1.x, cp2.x),
          maxY: Math.max(startY, endY, cp1.y, cp2.y),
        };
        list.push({
          id: `${node.id}-${child.id}`,
          start: { x: startX, y: startY },
          cp1,
          cp2,
          end: { x: endX, y: endY },
          onPath,
          bounds,
        });
      }
      traverse(child);
    });
  };
  traverse(root);
  return list;
}
