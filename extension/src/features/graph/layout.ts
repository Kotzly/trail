/**
 * Layout computation: NavigationTreeJSON → positioned React Flow nodes + edges.
 *
 * Tree and mindmap use d3-hierarchy (Reingold-Tilford).
 *
 * The work is split into two stages so metadata churn (current tab, open
 * tabs, tab counts) doesn't re-trigger the expensive geometric layout:
 *
 *   • `computeGeometry` — d3 layout, edge list, and per-node handle sets.
 *     Depends only on tree shape, collapsed set, and spacing settings.
 *   • `applyNodeMetadata` — walks the tree and produces fresh `TrailNode`
 *     objects with current/open/tab-count flags, reusing the geometry.
 *     Cheap enough to run synchronously on every tab activation.
 */

import type { NodeId } from "@shared/types/ids.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { Settings } from "@shared/types/settings.js";
import type { LayoutMode, LayoutResult, TrailEdge, TrailNode } from "./types.js";
import {
  treeToNodes,
  treeToEdges,
  applyEdgeHighlight,
  computeActivePathIds,
  type TreeToNodesMetadata,
} from "./transforms.js";
import { computeTreePositions } from "./tree-layout.js";
import { getSpacing } from "@shared/layout/spacing.js";

// ── Per-edge handle assignment ────────────────────────────────────

function assignEdgeHandles(edges: TrailEdge[], mode: LayoutMode): Map<string, Set<string>> {
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

// ── Stage 1: geometry ─────────────────────────────────────────────

/**
 * Geometry output — positions + edges + per-node handle lists. This is
 * the expensive part of layout: d3-hierarchy, edge walk, handle
 * assignment. Cache across metadata changes.
 */
export type Geometry = {
  positions: Map<string, { x: number; y: number }>;
  /** Base edges (no active-path styling). Apply styling per render. */
  baseEdges: TrailEdge[];
  handlesByNode: Map<string, readonly string[]>;
};

const EMPTY_HANDLES: readonly string[] = Object.freeze([]);
const EMPTY_GEOMETRY: Geometry = Object.freeze({
  positions: new Map(),
  baseEdges: [],
  handlesByNode: new Map(),
});

function computeFreshPositions(
  tree: NavigationTreeJSON,
  settings: Settings,
  collapsedNodeIds: Set<NodeId>,
): Map<string, { x: number; y: number }> {
  const { nodeSpacing, layerSpacing } = getSpacing(settings.graphDensity);
  return computeTreePositions({
    tree,
    collapsedNodeIds,
    mode: settings.layout.mode,
    nodeSpacing,
    layerSpacing,
  });
}

export function computeGeometry(
  tree: NavigationTreeJSON | null,
  settings: Settings,
  collapsedNodeIds: Set<NodeId>,
  precomputedPositions?: Record<string, { x: number; y: number }> | null | undefined,
): Geometry {
  if (!tree?.root) return EMPTY_GEOMETRY;

  const baseEdges = treeToEdges(tree, collapsedNodeIds);

  // Pre-computed background cache is only usable when the user hasn't
  // collapsed anything AND every expected node is covered. Otherwise a
  // stale cache would leave new nodes pinned at (0, 0).
  let positions: Map<string, { x: number; y: number }>;

  if (precomputedPositions && collapsedNodeIds.size === 0) {
    const candidate = new Map(Object.entries(precomputedPositions));
    // Quick coverage check: every edge endpoint must have a position.
    // Cheaper than walking the tree again — edges already enumerate all
    // currently-visible nodes (plus the root), and we only need to know
    // if the cache is stale enough to need a fallback compute.
    let covered = candidate.has(String(tree.root.id));
    if (covered) {
      for (const e of baseEdges) {
        if (!candidate.has(e.target)) {
          covered = false;
          break;
        }
      }
    }
    positions = covered ? candidate : computeFreshPositions(tree, settings, collapsedNodeIds);
  } else {
    positions = computeFreshPositions(tree, settings, collapsedNodeIds);
  }

  const rawHandles = assignEdgeHandles(baseEdges, settings.layout.mode);
  const handlesByNode = new Map<string, readonly string[]>();
  for (const [id, set] of rawHandles) {
    handlesByNode.set(id, Array.from(set));
  }

  return { positions, baseEdges, handlesByNode };
}

// ── Stage 2: metadata → TrailNodes ────────────────────────────────

/**
 * Build positioned `TrailNode` objects from pre-computed geometry and
 * current metadata. Falls back to d3 layout for nodes the geometry
 * doesn't cover (fresh arrivals after the cache was captured).
 */
export function applyNodeMetadata(
  tree: NavigationTreeJSON | null,
  settings: Settings,
  collapsedNodeIds: Set<NodeId>,
  metadata: LayoutMetadata,
  geometry: Geometry,
  activePathIds?: Set<NodeId>,
): TrailNode[] {
  if (!tree?.root) return [];

  const fullMetadata: TreeToNodesMetadata = {
    ...metadata,
    collapsedNodeIds,
  };

  const path = activePathIds ?? computeActivePathIds(tree, metadata.currentNodeId);
  const nodes = treeToNodes(tree, fullMetadata, path);

  if (nodes.length === 0) return nodes;

  let positions = geometry.positions;
  // Defense-in-depth: if a node arrives between the geometry memo and
  // this metadata pass, fall back to a fresh d3 compute. Should be rare
  // because `useGraphLayout` keys geometry on `tree`.
  let needsFallback = false;
  for (const n of nodes) {
    if (!positions.has(n.id)) {
      needsFallback = true;
      break;
    }
  }
  if (needsFallback) {
    positions = computeFreshPositions(tree, settings, collapsedNodeIds);
  }

  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (pos) node.position = pos;
    const handles = geometry.handlesByNode.get(node.id) ?? EMPTY_HANDLES;
    node.data.handles = handles as string[];
  }

  return nodes;
}

// ── Public API ─────────────────────────────────────────────────────

export type LayoutMetadata = Omit<TreeToNodesMetadata, "collapsedNodeIds">;

/**
 * Single-shot layout (geometry + metadata). Kept for external callers /
 * one-off computation; the UI path uses `useGraphLayout` which caches
 * the geometry separately.
 */
export async function computeLayout(
  tree: NavigationTreeJSON | null,
  settings: Settings,
  collapsedNodeIds: Set<NodeId>,
  metadata: LayoutMetadata,
  precomputedPositions?: Record<string, { x: number; y: number }> | null | undefined,
): Promise<LayoutResult> {
  if (!tree?.root) return { nodes: [], edges: [] };

  const geometry = computeGeometry(tree, settings, collapsedNodeIds, precomputedPositions);
  const activePathIds = computeActivePathIds(tree, metadata.currentNodeId);
  const nodes = applyNodeMetadata(
    tree,
    settings,
    collapsedNodeIds,
    metadata,
    geometry,
    activePathIds,
  );
  const edges = applyEdgeHighlight(geometry.baseEdges, activePathIds);

  return { nodes, edges };
}
