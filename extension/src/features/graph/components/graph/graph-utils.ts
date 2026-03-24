import type { NodeId } from "@shared/types/ids.js";
import type { NavigationNode } from "@shared/types/node.js";
import type { LayoutMode, NodePosition } from "../../graph/types.js";
import type { ConnectionSegment } from "../../graph/render/types.js";

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

type Point = { x: number; y: number };

function orthogonalSegment(
  id: string,
  start: Point,
  cp1: Point,
  cp2: Point,
  end: Point,
  onPath: boolean,
): ConnectionSegment {
  return {
    id,
    start,
    cp1,
    cp2,
    end,
    onPath,
    style: "orthogonal",
    bounds: {
      minX: Math.min(start.x, end.x, cp1.x, cp2.x),
      minY: Math.min(start.y, end.y, cp1.y, cp2.y),
      maxX: Math.max(start.x, end.x, cp1.x, cp2.x),
      maxY: Math.max(start.y, end.y, cp1.y, cp2.y),
    },
  };
}

export function applyPathHighlight(
  baseConnections: ConnectionSegment[],
  pathNodeIds: Set<NodeId> | null,
): ConnectionSegment[] {
  if (!pathNodeIds) return baseConnections;
  return baseConnections.map((conn) => {
    const [parentId, childId] = conn.id.split("::") as unknown as [NodeId, NodeId];
    const shouldHighlight = pathNodeIds.has(parentId) && pathNodeIds.has(childId);
    return shouldHighlight !== conn.onPath ? { ...conn, onPath: shouldHighlight } : conn;
  });
}

export function buildConnections(
  root: NavigationNode | null,
  positions: Map<NodeId, NodePosition>,
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

    const children = node.getChildren();
    const childEntries = children
      .map((child) => ({ child, pos: positions.get(child.id) }))
      .filter((e): e is { child: NavigationNode; pos: NodePosition } => !!e.pos);

    if (childEntries.length > 0 && layoutMode === "tree") {
      const hidden = hideRoot && node.isRoot();
      if (!hidden) {
        const startX = parentPos.x + nodeWidth / 2;
        const startY = parentPos.y + nodeHeight;

        const normalChildren = childEntries.filter((e) => e.pos.y >= startY);
        const outlierChildren = childEntries.filter((e) => e.pos.y < startY);

        if (normalChildren.length === 1) {
          const e = normalChildren[0]!;
          const endX = e.pos.x + nodeWidth / 2;
          const endY = e.pos.y;
          const busY = (startY + endY) / 2;
          list.push(
            orthogonalSegment(
              `${node.id}::${e.child.id}`,
              { x: startX, y: startY },
              { x: startX, y: busY },
              { x: endX, y: busY },
              { x: endX, y: endY },
              false,
            ),
          );
        } else if (normalChildren.length >= 2) {
          const firstChildY = Math.min(...normalChildren.map((e) => e.pos.y));
          const busY = (startY + firstChildY) / 2;

          normalChildren.forEach((e) => {
            const endX = e.pos.x + nodeWidth / 2;
            const endY = e.pos.y;
            list.push(
              orthogonalSegment(
                `${node.id}::${e.child.id}`,
                { x: startX, y: startY },
                { x: startX, y: busY },
                { x: endX, y: busY },
                { x: endX, y: endY },
                false,
              ),
            );
          });
        }

        outlierChildren.forEach((e) => {
          const oStartY = parentPos.y;
          const endX = e.pos.x + nodeWidth / 2;
          const endY = e.pos.y + nodeHeight;
          const busY = (oStartY + endY) / 2;
          list.push(
            orthogonalSegment(
              `${node.id}::${e.child.id}`,
              { x: startX, y: oStartY },
              { x: startX, y: busY },
              { x: endX, y: busY },
              { x: endX, y: endY },
              false,
            ),
          );
        });
      }
    } else if (childEntries.length > 0 && layoutMode === "mindmap") {
      const rightChildren = childEntries.filter((e) => e.pos.x >= parentPos.x);
      const leftChildren = childEntries.filter((e) => e.pos.x < parentPos.x);

      const emitMindmapSide = (entries: typeof childEntries, direction: 1 | -1) => {
        if (entries.length === 0) return;
        const sX = parentPos.x + (direction === 1 ? nodeWidth : 0);
        const sY = parentPos.y + nodeHeight / 2;

        const normalEntries = entries.filter((e) =>
          direction === 1 ? e.pos.x >= parentPos.x + nodeWidth : e.pos.x + nodeWidth <= parentPos.x,
        );
        const outlierEntries = entries.filter((e) =>
          direction === 1 ? e.pos.x < parentPos.x + nodeWidth : e.pos.x + nodeWidth > parentPos.x,
        );

        if (normalEntries.length === 1) {
          const e = normalEntries[0]!;
          const eX = e.pos.x + (direction === 1 ? 0 : nodeWidth);
          const eY = e.pos.y + nodeHeight / 2;
          const busX = (sX + eX) / 2;
          list.push(
            orthogonalSegment(
              `${node.id}::${e.child.id}`,
              { x: sX, y: sY },
              { x: busX, y: sY },
              { x: busX, y: eY },
              { x: eX, y: eY },
              false,
            ),
          );
        } else if (normalEntries.length >= 2) {
          const midX =
            (sX +
              normalEntries.reduce(
                (acc, e) => {
                  const edge = e.pos.x + (direction === 1 ? 0 : nodeWidth);
                  return direction === 1 ? Math.min(acc, edge) : Math.max(acc, edge);
                },
                direction === 1 ? Infinity : -Infinity,
              )) /
            2;

          normalEntries.forEach((e) => {
            const eX = e.pos.x + (direction === 1 ? 0 : nodeWidth);
            const eY = e.pos.y + nodeHeight / 2;
            list.push(
              orthogonalSegment(
                `${node.id}::${e.child.id}`,
                { x: sX, y: sY },
                { x: midX, y: sY },
                { x: midX, y: eY },
                { x: eX, y: eY },
                false,
              ),
            );
          });
        }

        outlierEntries.forEach((e) => {
          const oSX = parentPos.x + (direction === 1 ? 0 : nodeWidth);
          const eX = e.pos.x + (direction === 1 ? nodeWidth : 0);
          const eY = e.pos.y + nodeHeight / 2;
          const busX = (oSX + eX) / 2;
          list.push(
            orthogonalSegment(
              `${node.id}::${e.child.id}`,
              { x: oSX, y: sY },
              { x: busX, y: sY },
              { x: busX, y: eY },
              { x: eX, y: eY },
              false,
            ),
          );
        });
      };

      emitMindmapSide(rightChildren, 1);
      emitMindmapSide(leftChildren, -1);
    } else {
      // Radial: keep existing bezier logic
      childEntries.forEach((e) => {
        const startX = parentPos.x + nodeWidth / 2;
        const startY = parentPos.y + nodeHeight / 2;
        const endX = e.pos.x + nodeWidth / 2;
        const endY = e.pos.y + nodeHeight / 2;
        const midX = (startX + endX) / 2;
        const cp1 = { x: midX, y: startY };
        const cp2 = { x: midX, y: endY };
        list.push({
          id: `${node.id}::${e.child.id}`,
          start: { x: startX, y: startY },
          cp1,
          cp2,
          end: { x: endX, y: endY },
          onPath: false,
          style: "bezier",
          bounds: {
            minX: Math.min(startX, endX, cp1.x, cp2.x),
            minY: Math.min(startY, endY, cp1.y, cp2.y),
            maxX: Math.max(startX, endX, cp1.x, cp2.x),
            maxY: Math.max(startY, endY, cp1.y, cp2.y),
          },
        });
      });
    }

    children.forEach((child) => traverse(child));
  };

  traverse(root);
  return list;
}
