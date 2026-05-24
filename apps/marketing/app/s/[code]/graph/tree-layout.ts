/**
 * Pure tree-layout function ported from
 * `extension/src/features/graph/tree-layout.ts`. The marketing viewer
 * only renders read-only graphs, so we keep the trimmed-down version
 * here (no collapsed-id substitution, no chain folding, no mindmap
 * mode) and pin a single orientation matching the extension's default.
 *
 * Source-of-truth duplication is intentional — the marketing app must
 * not depend on the WXT build graph. If the extension's algorithm
 * changes in a way that affects layout fidelity, mirror the change
 * here.
 */

import { hierarchy, tree as d3tree } from "d3-hierarchy";
import type { SharedTrailNode } from "@/lib/shared-trail-types";

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 64;

const NODE_SPACING = 28;
const LAYER_SPACING = 56;

export type LayoutPoint = { x: number; y: number };

export function computeTreePositions(
  root: SharedTrailNode,
): Map<string, LayoutPoint> {
  const positions = new Map<string, LayoutPoint>();

  const h = hierarchy<SharedTrailNode>(root, (node) => node.children);

  const layout = d3tree<SharedTrailNode>()
    .nodeSize([NODE_WIDTH + NODE_SPACING, NODE_HEIGHT + LAYER_SPACING])
    .separation(() => 1);

  layout(h);

  h.each((n) => {
    const id = String(n.data.id);
    const cx = n.x ?? 0;
    const cy = n.y ?? 0;
    positions.set(id, {
      x: cx - NODE_WIDTH / 2,
      y: cy,
    });
  });

  return positions;
}

/**
 * Flatten a snapshot into the (nodes, edges) shape ReactFlow expects.
 * Each edge connects a parent's bottom handle to its child's top
 * handle.
 */
export function flattenForGraph(root: SharedTrailNode): {
  flat: Array<{ node: SharedTrailNode; parentId: string | null }>;
} {
  const flat: Array<{ node: SharedTrailNode; parentId: string | null }> = [];
  const stack: Array<{ node: SharedTrailNode; parentId: string | null }> = [
    { node: root, parentId: null },
  ];
  while (stack.length > 0) {
    const entry = stack.pop()!;
    flat.push(entry);
    for (let i = entry.node.children.length - 1; i >= 0; i--) {
      stack.push({ node: entry.node.children[i]!, parentId: entry.node.id });
    }
  }
  return { flat };
}
