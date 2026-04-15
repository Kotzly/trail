/**
 * Layout computation: NavigationTreeJSON → positioned React Flow nodes + edges.
 *
 * Tree and mindmap use d3-hierarchy (Reingold-Tilford).
 */

import type { NodeId } from "@shared/types/ids.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { Settings } from "@shared/types/settings.js";
import type { LayoutMode, LayoutResult, TrailEdge } from "./types.js";
import { treeToNodes, treeToEdges, computeActivePathIds, type TreeToNodesMetadata } from "./transforms.js";
import { computeTreePositions } from "./tree-layout.js";
import { getSpacing } from "@shared/layout/spacing.js";

// ── Per-edge handle assignment ────────────────────────────────────

function assignEdgeHandles(
  edges: TrailEdge[],
  mode: LayoutMode,
): Map<string, Set<string>> {
  const nodeHandles = new Map<string, Set<string>>();

  function addHandle(nodeId: string, handleId: string) {
    let set = nodeHandles.get(nodeId);
    if (!set) {
      set = new Set();
      nodeHandles.set(nodeId, set);
    }
    set.add(handleId);
  }

  for (const edge of edges) {
    switch (mode) {
      case "tree":
        edge.sourceHandle = "source-bottom";
        edge.targetHandle = "target-top";
        addHandle(edge.source, "source-bottom");
        addHandle(edge.target, "target-top");
        break;
      case "mindmap":
        edge.sourceHandle = "source-right";
        edge.targetHandle = "target-left";
        addHandle(edge.source, "source-right");
        addHandle(edge.target, "target-left");
        break;
    }
  }

  return nodeHandles;
}

// ── Public API ─────────────────────────────────────────────────────

export type LayoutMetadata = Omit<TreeToNodesMetadata, "collapsedNodeIds">;

export async function computeLayout(
  tree: NavigationTreeJSON | null,
  settings: Settings,
  collapsedNodeIds: Set<NodeId>,
  metadata: LayoutMetadata,
  precomputedPositions?: Record<string, { x: number; y: number }> | null | undefined,
): Promise<LayoutResult> {
  if (!tree?.root) {
    return { nodes: [], edges: [] };
  }

  const fullMetadata: TreeToNodesMetadata = {
    ...metadata,
    collapsedNodeIds,
  };

  // Build flat node/edge lists (unpositioned)
  const activePathIds = computeActivePathIds(tree, metadata.currentNodeId);
  const nodes = treeToNodes(tree, fullMetadata);
  const edges = treeToEdges(tree, collapsedNodeIds, activePathIds);

  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Compute positions — use pre-computed if available, else d3-hierarchy
  let positions: Map<string, { x: number; y: number }>;

  if (precomputedPositions && collapsedNodeIds.size === 0) {
    // Fast path: background already computed positions for fully-expanded tree
    positions = new Map(Object.entries(precomputedPositions));
  } else {
    const { nodeSpacing, layerSpacing } = getSpacing(settings.graphDensity);
    positions = computeTreePositions({
      tree,
      collapsedNodeIds,
      mode: settings.layout.mode,
      nodeSpacing,
      layerSpacing,
    });
  }

  // Apply positions to nodes
  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (pos) {
      node.position = pos;
    }
  }

  // Assign per-edge handles based on layout mode
  const nodeHandles = assignEdgeHandles(edges, settings.layout.mode);

  // Write handle set into node data so TrailNode renders only needed handles
  for (const node of nodes) {
    const handles = nodeHandles.get(node.id);
    node.data.handles = handles ? Array.from(handles) : [];
  }

  return { nodes, edges };
}
