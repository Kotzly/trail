import type { TreeNode } from '../../../../background/state/tree-node';
import type { NodePosition, CanvasBounds } from '../types';
import { getLayoutConfig, PADDING } from './config';

/**
 * Calculate positions for all nodes in a single tree.
 * Vertical layout: root at top, children below, spreading horizontally.
 * Uses proper subtree width calculation to avoid overlapping.
 */
export function calculateTreeLayout(
  root: TreeNode,
  startX: number = PADDING
): { positions: Map<number, NodePosition>, width: number } {
  const positions = new Map<number, NodePosition>();
  const subtreeWidths = new Map<number, number>();
  const layoutConfig = getLayoutConfig();
  const { nodeWidth, nodeHeight, verticalGap, horizontalGap } = layoutConfig;
  
  // First pass: calculate subtree widths (bottom-up)
  function calcWidths(node: TreeNode | null): number {
    if (!node) return 0;
    if (!node.children || node.children.length === 0) {
      subtreeWidths.set(node.id, nodeWidth);
      return nodeWidth;
    }
    
    let totalWidth = 0;
    node.children.forEach((child: TreeNode, idx: number) => {
      totalWidth += calcWidths(child);
      if (idx < node.children.length - 1) {
        totalWidth += horizontalGap;
      }
    });
    
    const width = Math.max(nodeWidth, totalWidth);
    subtreeWidths.set(node.id, width);
    return width;
  }
  
  const treeWidth = calcWidths(root);
  
  // Second pass: assign positions (top-down)
  function layoutNode(node: TreeNode | null, x: number, y: number): void {
    if (!node) return;
    
    const subtreeWidth = subtreeWidths.get(node.id) || nodeWidth;
    
    // Center this node within its subtree width
    const nodeX = x + (subtreeWidth - nodeWidth) / 2;
    positions.set(node.id, { x: nodeX, y, node });
    
    if (!node.children || node.children.length === 0) {
      return;
    }
    
    // Position children below
    const childY = y + nodeHeight + verticalGap;
    let childX = x;
    
    node.children.forEach((child: TreeNode) => {
      const childWidth = subtreeWidths.get(child.id) || nodeWidth;
      layoutNode(child, childX, childY);
      childX += childWidth + horizontalGap;
    });
  }
  
  layoutNode(root, startX, PADDING);
  
  return { positions, width: treeWidth };
}

/**
 * Calculate positions for a forest (multiple root trees).
 * Trees are arranged horizontally, left to right.
 */
export function calculateForestLayout(
  roots: TreeNode[]
): Map<number, NodePosition> {
  const allPositions = new Map<number, NodePosition>();
  let currentX = PADDING;
  const layoutConfig = getLayoutConfig();
  
  roots.forEach((root: TreeNode) => {
    const { positions, width } = calculateTreeLayout(root, currentX);
    
    // Merge positions into allPositions
    positions.forEach((pos, id) => {
      allPositions.set(id, pos);
    });
    
    // Move X for next tree
    currentX += width + layoutConfig.rootGap;
  });
  
  return allPositions;
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

