/**
 * Converts NavigationTreeJSON → dagre graph → positioned node map.
 *
 * Dagre (Sugiyama / layered) is ~10× faster than ELK mrtree on large trees
 * while producing comparable quality for tree and mindmap layouts.
 */

import dagre from "@dagrejs/dagre";
import type { NodeId } from "@shared/types/ids.js";
import type { NavigationNodeJSON } from "@shared/types/node.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { LayoutMode } from "@shared/types/settings.js";

// ── Constants ──────────────────────────────────────────────────────

const NODE_WIDTH = 160;
const NODE_HEIGHT = 52;

// ── Tree → dagre graph ──────────────────────────────────────────────

export type LayoutGraphInput = {
  tree: NavigationTreeJSON;
  collapsedNodeIds: Set<NodeId>;
  mode: LayoutMode;
  nodeSpacing: number;
  layerSpacing: number;
};

function walkNode(
  node: NavigationNodeJSON,
  collapsedNodeIds: Set<NodeId>,
  g: dagre.graphlib.Graph,
): void {
  const id = String(node.id);
  g.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });

  if (collapsedNodeIds.has(node.id)) return;

  for (const child of node.children) {
    g.setEdge(id, String(child.id));
    walkNode(child, collapsedNodeIds, g);
  }
}

export function computeTreePositions(input: LayoutGraphInput): Map<string, { x: number; y: number }> {
  const { tree, collapsedNodeIds, mode, nodeSpacing, layerSpacing } = input;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: mode === "mindmap" ? "LR" : "TB",
    nodesep: nodeSpacing,
    ranksep: layerSpacing,
    marginx: 0,
    marginy: 0,
  });
  g.setDefaultEdgeLabel(() => ({}));

  if (tree.root) {
    walkNode(tree.root, collapsedNodeIds, g);
  }

  dagre.layout(g);

  // dagre positions are center-based; convert to top-left for React Flow
  const positions = new Map<string, { x: number; y: number }>();
  for (const id of g.nodes()) {
    const n = g.node(id);
    if (n) {
      positions.set(id, {
        x: n.x - NODE_WIDTH / 2,
        y: n.y - NODE_HEIGHT / 2,
      });
    }
  }

  return positions;
}

// ── Flat position record (for background cache) ───────────────────

export function computeTreePositionsRecord(
  input: LayoutGraphInput,
): Record<string, { x: number; y: number }> {
  return Object.fromEntries(computeTreePositions(input));
}

export { NODE_WIDTH, NODE_HEIGHT };
