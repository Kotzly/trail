import type { NodeId } from '../../../../shared/types/ids.js';
import type { NavigationNode } from '../../../../shared/types/node.js';
import type { LayoutMode, NodePosition } from '../../graph/types.js';

export type Connection = {
  id: string;
  d: string;
  branchClass: string;
  onPath: boolean;
};

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
): Connection[] {
  if (!root) return [];
  const list: Connection[] = [];
  const traverse = (node: NavigationNode | null) => {
    if (!node) return;
    const parentPos = positions.get(node.id);
    if (!parentPos) return;
    node.getChildren().forEach((child, idx) => {
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
      let d: string;
      if (layoutMode === 'tree') {
        d = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
      } else if (layoutMode === 'mindmap') {
        d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
      } else {
        d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
      }
      const onPath =
        pathNodeIds ? pathNodeIds.has(node.id) && pathNodeIds.has(child.id) : false;
      const hideConnection = layoutMode === 'tree' && hideRoot && node.isRoot();
      if (!hideConnection) {
        list.push({
          id: `${node.id}-${child.id}`,
          d,
          branchClass: `branch-${(idx % 5) + 1}`,
          onPath,
        });
      }
      traverse(child);
    });
  };
  traverse(root);
  return list;
}
