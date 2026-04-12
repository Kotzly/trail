/**
 * Layout computation: NavigationTreeJSON → positioned React Flow nodes + edges.
 *
 * All three layout modes (tree, mindmap, radial) use elkjs.
 */

import ELK from "elkjs/lib/elk.bundled.js";
import type { NodeId } from "@shared/types/ids.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { Settings } from "@shared/types/settings.js";
import type { LayoutResult } from "./types.js";
import { treeToNodes, treeToEdges, type TreeToNodesMetadata } from "./transforms.js";
import { treeToElkGraph, elkResultToPositions } from "./elk-graph.js";

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
  const edges = treeToEdges(tree, collapsedNodeIds);

  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Compute positions via elkjs
  const { nodeSpacing, layerSpacing } = getSpacing(settings.graphDensity);

  const elkGraph = treeToElkGraph({
    tree,
    collapsedNodeIds,
    mode: settings.layout.mode,
    nodeSpacing,
    layerSpacing,
  });

  const layoutedGraph = await elk.layout(elkGraph);
  const positions = elkResultToPositions(layoutedGraph);

  // Apply positions to nodes
  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (pos) {
      node.position = pos;
    }
  }

  return { nodes, edges };
}
