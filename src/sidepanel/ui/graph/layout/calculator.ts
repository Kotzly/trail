import { NavigationNode } from '../../../../shared/types/node.js';
import type { LayoutConfig, NodePosition, CanvasBounds, RadialLayoutConfig } from '../types.js';
import { getLayoutConfig, PADDING } from './config.js';


export function calculateLayout(
  root: NavigationNode,
  layoutConfig: LayoutConfig,
  startX: number = PADDING
): { positions: Map<number, NodePosition>, width: number } {
  const positions = new Map<number, NodePosition>();
  const subtreeWidths = new Map<number, number>();
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
 * Mindmap layout (left/right). Root stays centered, its children split into
 * left and right columns, and descendants inherit the side.
 */
export function calculateMindmapLayout(
  root: NavigationNode,
  layoutConfig: LayoutConfig
): { positions: Map<number, NodePosition>, width: number } {
  const positions = new Map<number, NodePosition>();
  const { nodeWidth, nodeHeight, verticalGap, horizontalGap } = layoutConfig;
  const subtreeHeights = new Map<number, number>();
  const sideById = new Map<number, 'left' | 'right'>();

  function calcHeights(node: NavigationNode | null): number {
    if (!node) return 0;
    const children = node.getChildren?.() ?? [];
    if (children.length === 0) {
      subtreeHeights.set(node.id, nodeHeight);
      return nodeHeight;
    }
    let total = 0;
    children.forEach((child, idx) => {
      total += calcHeights(child);
      if (idx < children.length - 1) total += verticalGap;
    });
    const height = Math.max(nodeHeight, total);
    subtreeHeights.set(node.id, height);
    return height;
  }

  function markSide(node: NavigationNode, side: 'left' | 'right'): void {
    sideById.set(node.id, side);
    node.getChildren?.().forEach((child) => markSide(child, side));
  }

  calcHeights(root);

  const rootChildren = root.getChildren?.() ?? [];
  const sorted = [...rootChildren].sort((a, b) => {
    return (subtreeHeights.get(b.id) ?? 0) - (subtreeHeights.get(a.id) ?? 0);
  });
  let leftHeight = 0;
  let rightHeight = 0;
  sorted.forEach((child) => {
    const height = subtreeHeights.get(child.id) ?? nodeHeight;
    if (leftHeight <= rightHeight) {
      markSide(child, 'left');
      leftHeight += height;
    } else {
      markSide(child, 'right');
      rightHeight += height;
    }
  });

  function layoutChildren(
    children: NavigationNode[],
    parentX: number,
    parentY: number,
    direction: 1 | -1
  ): void {
    if (children.length === 0) return;
    const totalHeight = children.reduce((sum, child) => {
      return sum + (subtreeHeights.get(child.id) ?? nodeHeight);
    }, 0) + verticalGap * (children.length - 1);
    let cursorY = parentY + nodeHeight / 2 - totalHeight / 2;
    children.forEach((child) => {
      const childHeight = subtreeHeights.get(child.id) ?? nodeHeight;
      const childX = parentX + direction * (nodeWidth + horizontalGap);
      const childY = cursorY;
      layoutNode(child, childX, childY, direction);
      cursorY += childHeight + verticalGap;
    });
  }

  function layoutNode(
    node: NavigationNode,
    x: number,
    y: number,
    direction: 1 | -1
  ): void {
    positions.set(node.id, { x, y, node });
    const children = node.getChildren?.() ?? [];
    if (children.length === 0) return;
    layoutChildren(children, x, y, direction);
  }

  const rootX = 0;
  const rootY = 0;
  positions.set(root.id, { x: rootX, y: rootY, node: root });

  const leftChildren = rootChildren.filter((child) => sideById.get(child.id) === 'left');
  const rightChildren = rootChildren.filter((child) => sideById.get(child.id) === 'right');
  layoutChildren(leftChildren, rootX, rootY, -1);
  layoutChildren(rightChildren, rootX, rootY, 1);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  positions.forEach((pos) => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + nodeWidth);
    maxY = Math.max(maxY, pos.y + nodeHeight);
  });

  const shiftX = minX < PADDING ? PADDING - minX : 0;
  const shiftY = minY < PADDING ? PADDING - minY : 0;
  if (shiftX !== 0 || shiftY !== 0) {
    positions.forEach((pos, id) => {
      positions.set(id, { ...pos, x: pos.x + shiftX, y: pos.y + shiftY });
    });
    maxX += shiftX;
    maxY += shiftY;
    minX += shiftX;
    minY += shiftY;
  }

  const width = maxX - minX + PADDING * 2;
  return { positions, width };
}

/**
 * Radial layout (all directions). Nodes are placed on concentric rings by depth,
 * and each node gets an angular span proportional to its subtree size.
 */
export function calculateRadialLayout(
  root: NavigationNode,
  layoutConfig: RadialLayoutConfig
): { positions: Map<number, NodePosition>, width: number } {
  const positions = new Map<number, NodePosition>();
  const baseLayout = getLayoutConfig();
  const { nodeWidth, nodeHeight } = baseLayout;

  const subtreeSizes = new Map<number, number>();
  const angleRanges = new Map<number, { start: number; end: number }>();
  const radiusById = new Map<number, number>();
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

  const ANGLE_WEIGHT_EXP = layoutConfig.angleWeightExp;
  const MIN_SPAN_FACTOR = layoutConfig.minSpanFactor;
  const MIN_SPAN_ABS = layoutConfig.minSpanAbs;
  const REQUIRED_SCALE = layoutConfig.requiredScale;
  const baseRadius = 0;
  const depthGapBase = layoutConfig.depthGapBase;
  const depthGapGrowth = layoutConfig.depthGapGrowth;
  const effectiveWidth = layoutConfig.effectiveWidth;

  function getChildSpans(children: NavigationNode[], totalSpan: number): number[] {
    if (children.length === 0) return [];
    const weights = children.map((child) => {
      const size = subtreeSizes.get(child.id) ?? 1;
      return Math.pow(size, ANGLE_WEIGHT_EXP);
    });
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    const rawSpans = weights.map((weight) => (totalSpan * weight) / weightSum);
    const equalSpan = totalSpan / children.length;
    const minSpan = Math.min(Math.max(equalSpan * MIN_SPAN_FACTOR, MIN_SPAN_ABS), equalSpan);

    let deficit = 0;
    const spans = rawSpans.map((span) => {
      if (span < minSpan) {
        deficit += minSpan - span;
        return minSpan;
      }
      return span;
    });

    if (deficit > 0) {
      const adjustableIndices = spans
        .map((span, idx) => (span > minSpan ? idx : -1))
        .filter((idx) => idx !== -1);
      const adjustableTotal = adjustableIndices.reduce((sum, idx) => sum + spans[idx]!, 0);
      if (adjustableTotal <= deficit + 1e-6) {
        return new Array(children.length).fill(equalSpan);
      }
      adjustableIndices.forEach((idx) => {
        spans[idx]! -= deficit * (spans[idx]! / adjustableTotal);
      });
    }

    const spanSum = spans.reduce((sum, span) => sum + span, 0) || totalSpan;
    const scale = totalSpan / spanSum;
    if (Math.abs(scale - 1) > 1e-6) {
      return spans.map((span) => span * scale);
    }
    return spans;
  }

  function assignAngles(
    node: NavigationNode,
    start: number,
    end: number,
    depth: number,
    parentRadius: number,
  ): void {
    nodeById.set(node.id, node);
    angleRanges.set(node.id, { start, end });

    const span = Math.max(end - start, MIN_SPAN_ABS);
    const depthGap = depth === 0 ? 0 : depthGapBase * (1 + (depth - 1) * depthGapGrowth);
    const desired = depth === 0 ? baseRadius : parentRadius + depthGap;
    const required = depth === 0 ? baseRadius : (effectiveWidth * REQUIRED_SCALE) / span;
    const radius = depth === 0 ? baseRadius : Math.max(desired, required);
    radiusById.set(node.id, radius);

    const children = node.getChildren?.() ?? [];
    if (children.length === 0) return;
    const totalSpan = end - start;
    const spans = getChildSpans(children, totalSpan);
    let cursor = start;
    children.forEach((child, idx) => {
      const childSpan = spans[idx] ?? 0;
      assignAngles(child, cursor, cursor + childSpan, depth + 1, radius);
      cursor += childSpan;
    });
  }

  calcSize(root);
  assignAngles(root, -Math.PI / 2, Math.PI * 1.5, 0, baseRadius);

  angleRanges.forEach((range, id) => {
    const radius = radiusById.get(id) ?? baseRadius;
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

  const maxRadius = Math.max(...Array.from(radiusById.values()), nodeWidth);
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
