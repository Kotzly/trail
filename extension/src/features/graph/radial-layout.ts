/**
 * Custom radial tree layout.
 *
 * Places the root at (0, 0) and distributes children on concentric rings
 * with monotonically increasing radius — children are always farther from
 * center than their parents.
 */

import type { NodeId } from "@shared/types/ids.js";
import type { NavigationNodeJSON } from "@shared/types/node.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { RadialLayoutSettings } from "@shared/types/settings.js";
import { NODE_WIDTH } from "./elk-graph.js";

// ── Helpers ──────────────────────────────────────────────────────

function countLeaves(
  node: NavigationNodeJSON,
  collapsed: Set<NodeId>,
): number {
  if (collapsed.has(node.id) || node.children.length === 0) return 1;
  let total = 0;
  for (const child of node.children) {
    total += countLeaves(child, collapsed);
  }
  return total;
}

function radiusAtDepth(depth: number, s: RadialLayoutSettings): number {
  if (depth === 0) return 0;
  return NODE_WIDTH * depth * (s.depthGapBase + s.depthGapGrowth * (depth - 1));
}

// ── Layout ───────────────────────────────────────────────────────

export function computeRadialPositions(
  tree: NavigationTreeJSON,
  collapsedNodeIds: Set<NodeId>,
  settings: RadialLayoutSettings,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  if (!tree.root) return positions;

  // Root at center
  positions.set(String(tree.root.id), { x: 0, y: 0 });

  placeChildren(tree.root, 0, -Math.PI, 2 * Math.PI, collapsedNodeIds, settings, positions);

  return positions;
}

function placeChildren(
  node: NavigationNodeJSON,
  depth: number,
  startAngle: number,
  spanAngle: number,
  collapsed: Set<NodeId>,
  settings: RadialLayoutSettings,
  positions: Map<string, { x: number; y: number }>,
): void {
  if (collapsed.has(node.id) || node.children.length === 0) return;

  const childRadius = radiusAtDepth(depth + 1, settings);

  // Compute weighted leaf counts for angular allocation
  const weights = node.children.map((c) =>
    Math.pow(countLeaves(c, collapsed), settings.angleWeightExp),
  );
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // Compute raw spans, enforce minimums, then normalize to fit
  const minSpan = Math.max(
    settings.minSpanAbs,
    spanAngle * settings.minSpanFactor / node.children.length,
  );

  const rawSpans = weights.map((w) => (w / totalWeight) * spanAngle);
  const spans = rawSpans.map((s) => Math.max(s, minSpan));

  // Normalize so children fit within parent's span
  const totalSpans = spans.reduce((a, b) => a + b, 0);
  if (totalSpans > spanAngle) {
    const scale = spanAngle / totalSpans;
    for (let i = 0; i < spans.length; i++) spans[i]! *= scale;
  }

  let currentAngle = startAngle;

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const childSpan = spans[i]!;
    const midAngle = currentAngle + childSpan / 2;

    // Apply per-node overrides
    const overrides = child.data.layout?.radial;
    const r = childRadius + (overrides?.radiusDelta ?? 0);
    const angle = midAngle + (overrides?.angleDelta ?? 0);

    positions.set(String(child.id), {
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
    });

    placeChildren(child, depth + 1, currentAngle, childSpan, collapsed, settings, positions);
    currentAngle += childSpan;
  }
}
