/**
 * Layout computation: NavigationTreeJSON → positioned React Flow nodes + edges.
 *
 * Tree and mindmap use elkjs; radial uses a custom algorithm.
 */

import ELK from "elkjs/lib/elk.bundled.js";
import type { NodeId } from "@shared/types/ids.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { Settings } from "@shared/types/settings.js";
import type { LayoutMode, LayoutResult, TrailEdge } from "./types.js";
import { treeToNodes, treeToEdges, type TreeToNodesMetadata } from "./transforms.js";
import { treeToElkGraph, elkResultToPositions, NODE_WIDTH, NODE_HEIGHT } from "./elk-graph.js";
import { computeRadialPositions } from "./radial-layout.js";

const elk = new ELK();

// ── Density → spacing ──────────────────────────────────────────────

function getSpacing(density: Settings["graphDensity"]): {
  nodeSpacing: number;
  layerSpacing: number;
} {
  switch (density) {
    case "compact":
      return { nodeSpacing: 16, layerSpacing: 60 };
    case "spacious":
      return { nodeSpacing: 32, layerSpacing: 100 };
    case "comfortable":
    default:
      return { nodeSpacing: 24, layerSpacing: 80 };
  }
}

// ── Per-edge handle assignment ────────────────────────────────────

function nearestSide(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const dx = (to.x + NODE_WIDTH / 2) - (from.x + NODE_WIDTH / 2);
  const dy = (to.y + NODE_HEIGHT / 2) - (from.y + NODE_HEIGHT / 2);

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "bottom" : "top";
}

function assignEdgeHandles(
  edges: TrailEdge[],
  positions: Map<string, { x: number; y: number }>,
  mode: LayoutMode,
): void {
  for (const edge of edges) {
    switch (mode) {
      case "tree":
        edge.sourceHandle = "source-bottom";
        edge.targetHandle = "target-top";
        break;
      case "mindmap":
        edge.sourceHandle = "source-right";
        edge.targetHandle = "target-left";
        break;
      case "radial": {
        const sp = positions.get(edge.source);
        const tp = positions.get(edge.target);
        if (sp && tp) {
          edge.sourceHandle = `source-${nearestSide(sp, tp)}`;
          edge.targetHandle = `target-${nearestSide(tp, sp)}`;
        }
        break;
      }
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────

export type LayoutMetadata = Omit<TreeToNodesMetadata, "collapsedNodeIds">;

export async function computeLayout(
  tree: NavigationTreeJSON | null,
  settings: Settings,
  collapsedNodeIds: Set<NodeId>,
  metadata: LayoutMetadata,
): Promise<LayoutResult> {
  if (!tree?.root) {
    return { nodes: [], edges: [] };
  }

  const fullMetadata: TreeToNodesMetadata = {
    ...metadata,
    collapsedNodeIds,
  };

  // Build flat node/edge lists (unpositioned)
  const nodes = treeToNodes(tree, fullMetadata);
  const edges = treeToEdges(tree, collapsedNodeIds, settings.layout.mode);

  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Compute positions — custom radial or ELK for tree/mindmap
  let positions: Map<string, { x: number; y: number }>;

  if (settings.layout.mode === "radial") {
    positions = computeRadialPositions(tree, collapsedNodeIds, settings.layout.radial);
  } else {
    const { nodeSpacing, layerSpacing } = getSpacing(settings.graphDensity);
    const elkGraph = treeToElkGraph({
      tree,
      collapsedNodeIds,
      mode: settings.layout.mode,
      nodeSpacing,
      layerSpacing,
    });
    const layoutedGraph = await elk.layout(elkGraph);
    positions = elkResultToPositions(layoutedGraph);
  }

  // Apply positions to nodes
  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (pos) {
      node.position = pos;
    }
  }

  // Assign per-edge handles based on layout mode + positions
  assignEdgeHandles(edges, positions, settings.layout.mode);

  return { nodes, edges };
}
