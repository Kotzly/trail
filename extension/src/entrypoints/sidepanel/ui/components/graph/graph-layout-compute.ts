/**
 * Pure layout computation functions extracted from GraphCanvas.
 * These are stateless functions that compute tree layout, offset-augmented
 * positions, and render models without requiring React hooks or refs.
 */

import type { NodeId } from '@shared/types/ids.js';
import type { NavigationNode } from '@shared/types/node.js';
import type { LayoutMode, NodePosition } from '../../graph/types.js';
import type { LayoutUpdateMap } from './graph-canvas-types.js';

/**
 * Apply user-defined offsets (drag offsets, manual repositioning) to base
 * layout positions. For tree/mindmap mode, offsets cascade from parent to
 * children. For radial mode, offsets are applied as angle/radius deltas.
 */
export function computeOffsetPositions(
  basePositions: Map<NodeId, NodePosition>,
  mode: LayoutMode,
  nodeWidth: number,
  nodeHeight: number,
  root: NavigationNode | null,
  dragPreview: LayoutUpdateMap | null,
): Map<NodeId, NodePosition> {
  if (basePositions.size === 0) return basePositions;

  if (mode !== 'radial') {
    const offsetCache = new Map<NodeId, { x: number; y: number }>();
    const computeOffset = (node: NavigationNode): { x: number; y: number } => {
      if (offsetCache.has(node.id)) return offsetCache.get(node.id)!;
      const parent = node.getParent?.();
      const parentOffset = parent ? computeOffset(parent) : { x: 0, y: 0 };
      const layoutData = node.data.layout;
      const offsetX = typeof layoutData?.offsetX === 'number' ? layoutData.offsetX : 0;
      const offsetY = typeof layoutData?.offsetY === 'number' ? layoutData.offsetY : 0;
      const previewLayout = dragPreview?.get(node.id);
      const previewOffsetX = typeof previewLayout?.offsetX === 'number' ? previewLayout.offsetX : null;
      const previewOffsetY = typeof previewLayout?.offsetY === 'number' ? previewLayout.offsetY : null;
      const extra = {
        x: previewOffsetX !== null ? previewOffsetX - offsetX : 0,
        y: previewOffsetY !== null ? previewOffsetY - offsetY : 0,
      };
      const total = {
        x: parentOffset.x + offsetX + extra.x,
        y: parentOffset.y + offsetY + extra.y,
      };
      offsetCache.set(node.id, total);
      return total;
    };
    const next = new Map<NodeId, NodePosition>();
    basePositions.forEach((pos, id) => {
      const offset = computeOffset(pos.node);
      next.set(id, { ...pos, x: pos.x + offset.x, y: pos.y + offset.y });
    });
    return next;
  }

  // Radial mode
  if (!root) return basePositions;
  const rootPos = basePositions.get(root.id);
  if (!rootPos) return basePositions;
  const centerX = rootPos.x + nodeWidth / 2;
  const centerY = rootPos.y + nodeHeight / 2;
  const offsetCache = new Map<NodeId, { angle: number; radius: number }>();
  const computeRadialOffset = (node: NavigationNode): { angle: number; radius: number } => {
    if (offsetCache.has(node.id)) return offsetCache.get(node.id)!;
    const parent = node.getParent?.();
    const parentOffset = parent ? computeRadialOffset(parent) : { angle: 0, radius: 0 };
    const radial = node.data.layout?.radial;
    const angleDelta = typeof radial?.angleDelta === 'number' ? radial.angleDelta : 0;
    const radiusDelta = typeof radial?.radiusDelta === 'number' ? radial.radiusDelta : 0;
    const previewLayout = dragPreview?.get(node.id);
    const previewRadial = previewLayout?.radial;
    const previewAngle = typeof previewRadial?.angleDelta === 'number' ? previewRadial.angleDelta : null;
    const previewRadius = typeof previewRadial?.radiusDelta === 'number' ? previewRadial.radiusDelta : null;
    const extra = {
      angle: previewAngle !== null ? previewAngle - angleDelta : 0,
      radius: previewRadius !== null ? previewRadius - radiusDelta : 0,
    };
    const total = {
      angle: parentOffset.angle + angleDelta + extra.angle,
      radius: parentOffset.radius + radiusDelta + extra.radius,
    };
    offsetCache.set(node.id, total);
    return total;
  };
  const next = new Map<NodeId, NodePosition>();
  basePositions.forEach((pos, id) => {
    const offset = computeRadialOffset(pos.node);
    const nodeCenterX = pos.x + nodeWidth / 2;
    const nodeCenterY = pos.y + nodeHeight / 2;
    const baseDx = nodeCenterX - centerX;
    const baseDy = nodeCenterY - centerY;
    const baseRadius = Math.hypot(baseDx, baseDy);
    const baseAngle = Math.atan2(baseDy, baseDx);
    const minRadius = pos.node.isRoot?.() ? 0 : nodeWidth * 0.35;
    const radius = Math.max(minRadius, baseRadius + offset.radius);
    const angle = baseAngle + offset.angle;
    const x = centerX + radius * Math.cos(angle) - nodeWidth / 2;
    const y = centerY + radius * Math.sin(angle) - nodeHeight / 2;
    next.set(id, { ...pos, x, y });
  });
  return next;
}

/**
 * Partial offset computation for drag: only recomputes nodes in affectedIds
 * (the dragged subtree + ancestors). All other nodes keep their previous
 * positions unchanged. This turns O(n) full-tree offset computation into
 * O(subtree+ancestors) during drag moves.
 */
export function computeDragOffsetPositions(
  basePositions: Map<NodeId, NodePosition>,
  prevPositions: Map<NodeId, NodePosition>,
  mode: LayoutMode,
  nodeWidth: number,
  nodeHeight: number,
  root: NavigationNode | null,
  dragPreview: LayoutUpdateMap,
  affectedIds: Set<NodeId>,
): Map<NodeId, NodePosition> {
  if (basePositions.size === 0) return basePositions;

  // Start from a shallow copy of previous positions — unaffected nodes stay as-is
  const next = new Map(prevPositions);

  if (mode !== 'radial') {
    const offsetCache = new Map<NodeId, { x: number; y: number }>();
    const computeOffset = (node: NavigationNode): { x: number; y: number } => {
      if (offsetCache.has(node.id)) return offsetCache.get(node.id)!;
      const parent = node.getParent?.();
      const parentOffset = parent ? computeOffset(parent) : { x: 0, y: 0 };
      const layoutData = node.data.layout;
      const offsetX = typeof layoutData?.offsetX === 'number' ? layoutData.offsetX : 0;
      const offsetY = typeof layoutData?.offsetY === 'number' ? layoutData.offsetY : 0;
      const previewLayout = dragPreview.get(node.id);
      const previewOffsetX = typeof previewLayout?.offsetX === 'number' ? previewLayout.offsetX : null;
      const previewOffsetY = typeof previewLayout?.offsetY === 'number' ? previewLayout.offsetY : null;
      const extra = {
        x: previewOffsetX !== null ? previewOffsetX - offsetX : 0,
        y: previewOffsetY !== null ? previewOffsetY - offsetY : 0,
      };
      const total = {
        x: parentOffset.x + offsetX + extra.x,
        y: parentOffset.y + offsetY + extra.y,
      };
      offsetCache.set(node.id, total);
      return total;
    };
    affectedIds.forEach((id) => {
      const pos = basePositions.get(id);
      if (!pos) return;
      const offset = computeOffset(pos.node);
      next.set(id, { ...pos, x: pos.x + offset.x, y: pos.y + offset.y });
    });
    return next;
  }

  // Radial mode
  if (!root) return prevPositions;
  const rootPos = basePositions.get(root.id);
  if (!rootPos) return prevPositions;
  const centerX = rootPos.x + nodeWidth / 2;
  const centerY = rootPos.y + nodeHeight / 2;
  const offsetCache = new Map<NodeId, { angle: number; radius: number }>();
  const computeRadialOffset = (node: NavigationNode): { angle: number; radius: number } => {
    if (offsetCache.has(node.id)) return offsetCache.get(node.id)!;
    const parent = node.getParent?.();
    const parentOffset = parent ? computeRadialOffset(parent) : { angle: 0, radius: 0 };
    const radial = node.data.layout?.radial;
    const angleDelta = typeof radial?.angleDelta === 'number' ? radial.angleDelta : 0;
    const radiusDelta = typeof radial?.radiusDelta === 'number' ? radial.radiusDelta : 0;
    const previewLayout = dragPreview.get(node.id);
    const previewRadial = previewLayout?.radial;
    const previewAngle = typeof previewRadial?.angleDelta === 'number' ? previewRadial.angleDelta : null;
    const previewRadius = typeof previewRadial?.radiusDelta === 'number' ? previewRadial.radiusDelta : null;
    const extra = {
      angle: previewAngle !== null ? previewAngle - angleDelta : 0,
      radius: previewRadius !== null ? previewRadius - radiusDelta : 0,
    };
    const total = {
      angle: parentOffset.angle + angleDelta + extra.angle,
      radius: parentOffset.radius + radiusDelta + extra.radius,
    };
    offsetCache.set(node.id, total);
    return total;
  };
  affectedIds.forEach((id) => {
    const pos = basePositions.get(id);
    if (!pos) return;
    const offset = computeRadialOffset(pos.node);
    const nodeCenterX = pos.x + nodeWidth / 2;
    const nodeCenterY = pos.y + nodeHeight / 2;
    const baseDx = nodeCenterX - centerX;
    const baseDy = nodeCenterY - centerY;
    const baseRadius = Math.hypot(baseDx, baseDy);
    const baseAngle = Math.atan2(baseDy, baseDx);
    const minRadius = pos.node.isRoot?.() ? 0 : nodeWidth * 0.35;
    const radius = Math.max(minRadius, baseRadius + offset.radius);
    const angle = baseAngle + offset.angle;
    const x = centerX + radius * Math.cos(angle) - nodeWidth / 2;
    const y = centerY + radius * Math.sin(angle) - nodeHeight / 2;
    next.set(id, { ...pos, x, y });
  });
  return next;
}
