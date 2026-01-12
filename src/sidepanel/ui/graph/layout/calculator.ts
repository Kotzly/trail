import { NavigationNode } from '../../../../shared/types/node.js';
import type { NodePosition, CanvasBounds } from '../types.js';
import { getLayoutConfig, PADDING } from './config.js';


export function calculateLayout(
  root: NavigationNode,
  startX: number = PADDING
): { positions: Map<number, NodePosition>, width: number } {
  const positions = new Map<number, NodePosition>();
  const subtreeWidths = new Map<number, number>();
  const layoutConfig = getLayoutConfig();
  const { nodeWidth, nodeHeight, verticalGap, horizontalGap } = layoutConfig;
  
  // First pass: calculate subtree widths (bottom-up)
  function calcWidths(node: NavigationNode | null): number {
    if (!node) return 0;
    if (!node.getChildren() || node.getChildren().length === 0) {
      subtreeWidths.set(node.id, nodeWidth);
      return nodeWidth;
    }

    let totalWidth = 0;
    node.getChildren().forEach((child: NavigationNode, idx: number) => {
      totalWidth += calcWidths(child);
      if (idx < node.getChildren().length - 1) {
        totalWidth += horizontalGap;
      }
    });
    
    const width = Math.max(nodeWidth, totalWidth);
    subtreeWidths.set(node.id, width);
    return width;
  }
  
  const treeWidth = calcWidths(root);
  
  // Second pass: assign positions (top-down)
  function layoutNode(node: NavigationNode | null, x: number, y: number): void {
    if (!node) return;
    
    const subtreeWidth = subtreeWidths.get(node.id) || nodeWidth;
    
    // Center this node within its subtree width
    const nodeX = x + (subtreeWidth - nodeWidth) / 2;
    positions.set(node.id, { x: nodeX, y, node });
    
    if (!node.getChildren() || node.getChildren().length === 0) {
      return;
    }
    
    // Position children below
    const childY = y + nodeHeight + verticalGap;
    let childX = x;
    
    node.getChildren().forEach((child: NavigationNode) => {
      const childWidth = subtreeWidths.get(child.id) || nodeWidth;
      layoutNode(child, childX, childY);
      childX += childWidth + horizontalGap;
    });
  }
  
  layoutNode(root, startX, PADDING);
  
  return { positions, width: treeWidth };
}

/**
 * Radial layout (all directions). Nodes are placed on concentric rings by depth,
 * and each node gets an angular span proportional to its subtree size.
 */
export function calculateRadialLayout(
  root: NavigationNode
): { positions: Map<number, NodePosition>, width: number } {
  const positions = new Map<number, NodePosition>();
  const layoutConfig = getLayoutConfig();
  const { nodeWidth, nodeHeight, verticalGap, horizontalGap } = layoutConfig;

  const subtreeSizes = new Map<number, number>();
  const angleRanges = new Map<number, { start: number; end: number }>();
  const depthById = new Map<number, number>();
  const nodeById = new Map<number, NavigationNode>();

  function calcSize(node: NavigationNode | null): number {
    if (!node) return 0;
    const children = node.getChildren?.() ?? [];
    let size = 1;
    children.forEach((child) => {
      size += calcSize(child);
    });
    subtreeSizes.set(node.id, size);
    return size;
  }

  function assignAngles(
    node: NavigationNode,
    start: number,
    end: number,
    depth: number,
  ): void {
    nodeById.set(node.id, node);
    angleRanges.set(node.id, { start, end });
    depthById.set(node.id, depth);
    const children = node.getChildren?.() ?? [];
    if (children.length === 0) return;
    const total = children.reduce((sum, child) => sum + (subtreeSizes.get(child.id) ?? 1), 0);
    let cursor = start;
    children.forEach((child) => {
      const portion = total === 0 ? 0 : (subtreeSizes.get(child.id) ?? 1) / total;
      const span = (end - start) * portion;
      assignAngles(child, cursor, cursor + span, depth + 1);
      cursor += span;
    });
  }

  calcSize(root);
  assignAngles(root, -Math.PI / 2, Math.PI * 1.5, 0);

  const radialGap = Math.max(nodeHeight, nodeWidth) + verticalGap;
  const baseRadius = 0;
  const minAngle = 0.0005;
  const radiusByDepth = new Map<number, number>();

  angleRanges.forEach((range, id) => {
    const depth = depthById.get(id) ?? 0;
    const span = Math.max(minAngle, range.end - range.start);
    const desired = baseRadius + depth * radialGap;
    const required = (nodeWidth + horizontalGap) / span;
    const next = Math.max(desired, required);
    const prev = radiusByDepth.get(depth) ?? 0;
    if (next > prev) radiusByDepth.set(depth, next);
  });

  const sortedDepths = Array.from(radiusByDepth.keys()).sort((a, b) => a - b);
  let previousRadius = baseRadius;
  sortedDepths.forEach((depth) => {
    const current = radiusByDepth.get(depth) ?? baseRadius;
    const minRadius = depth === 0 ? baseRadius : previousRadius + radialGap;
    const adjusted = Math.max(current, minRadius);
    radiusByDepth.set(depth, adjusted);
    previousRadius = adjusted;
  });

  angleRanges.forEach((range, id) => {
    const depth = depthById.get(id) ?? 0;
    const radius = radiusByDepth.get(depth) ?? baseRadius;
    const angle = (range.start + range.end) / 2;
    const x = radius * Math.cos(angle) - nodeWidth / 2;
    const y = radius * Math.sin(angle) - nodeHeight / 2;
    const node = nodeById.get(id);
    if (!node) return;
    positions.set(id, { x, y, node });
  });

  // Normalize positions to keep everything in positive space.
  let minX = Infinity;
  let minY = Infinity;
  positions.forEach((pos) => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
  });
  const shiftX = minX < PADDING ? PADDING - minX : 0;
  const shiftY = minY < PADDING ? PADDING - minY : 0;
  if (shiftX !== 0 || shiftY !== 0) {
    positions.forEach((pos, id) => {
      positions.set(id, { ...pos, x: pos.x + shiftX, y: pos.y + shiftY });
    });
  }

  const maxRadius = Math.max(...Array.from(radiusByDepth.values()), nodeWidth);
  return { positions, width: maxRadius * 2 + nodeWidth };
}


/**
 * Get canvas bounds from positions.
 */
export function getCanvasBounds(positions: Map<number, NodePosition>): CanvasBounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const layoutConfig = getLayoutConfig();
  const { nodeWidth, nodeHeight } = layoutConfig;
  
  positions.forEach((pos: NodePosition) => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + nodeWidth);
    maxY = Math.max(maxY, pos.y + nodeHeight);
  });
  
  return { 
    minX, minY, maxX, maxY, 
    width: maxX + PADDING, 
    height: maxY + PADDING 
  };
}
