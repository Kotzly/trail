/**
 * Pure transforms: NavigationTreeJSON → React Flow nodes/edges.
 *
 * These are the data contracts between the tree model and the graph UI.
 * Layout positions are NOT set here — that's handled by layout.ts.
 */

import { hierarchy } from "d3-hierarchy";
import type { NodeId } from "@shared/types/ids.js";
import type { NavigationNodeJSON } from "@shared/types/node.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { TrailNode, TrailNodeData, TrailEdge } from "./types.js";
import { NODE_WIDTH, NODE_HEIGHT } from "./tree-layout.js";

export type TreeToNodesMetadata = {
  currentNodeId: NodeId | null;
  openNodeIds: Set<NodeId>;
  nodeTabCounts: Record<NodeId, number>;
  collapsedNodeIds: Set<NodeId>;
};

/**
 * Build the set of node IDs on the path from root to `targetId` (inclusive).
 * Returns empty set if target not found or null.
 */
export function computeActivePathIds(
  tree: NavigationTreeJSON | null,
  targetId: NodeId | null,
): Set<NodeId> {
  if (!tree?.root || targetId === null) return new Set<NodeId>();
  const root = hierarchy<NavigationNodeJSON>(tree.root, (n) => n.children);
  const target = root.find((n) => n.data.id === targetId);
  if (!target) return new Set<NodeId>();
  return new Set(target.ancestors().map((n) => n.data.id));
}

/**
 * Walk the tree and produce a flat list of TrailNodes.
 * Collapsed subtrees are excluded (the collapsed parent is included but not its children).
 */
export function treeToNodes(
  tree: NavigationTreeJSON | null,
  metadata: TreeToNodesMetadata,
): TrailNode[] {
  if (!tree?.root) return [];

  const activePathIds = computeActivePathIds(tree, metadata.currentNodeId);
  const nodes: TrailNode[] = [];

  function walk(node: NavigationNodeJSON): void {
    const isCollapsed = metadata.collapsedNodeIds.has(node.id);

    const data = {
      nodeId: node.id,
      url: node.data.url,
      title: node.data.title,
      pinned: node.data.pinned,
      isCurrent: node.id === metadata.currentNodeId,
      isOpen: metadata.openNodeIds.has(node.id),
      onActivePath: activePathIds.has(node.id),
      tabCount: metadata.nodeTabCounts[node.id] ?? 0,
      childCount: node.children.length,
      isCollapsed,
      handles: [], // filled by layout
    } as TrailNodeData;
    if (node.data.favicon !== undefined) {
      data.favicon = node.data.favicon;
    }

    nodes.push({
      id: String(node.id),
      type: "trail",
      position: { x: 0, y: 0 }, // filled by layout
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      // Pre-initialize measured dimensions so React Flow treats nodes as initialized
      // immediately, preventing error #015 when dragging right after a layout update
      measured: { width: NODE_WIDTH, height: NODE_HEIGHT },
      data,
    });

    // Skip children of collapsed nodes
    if (!isCollapsed) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(tree.root);
  return nodes;
}

/**
 * Walk the tree and produce a flat list of edges (parent → child).
 * Edges to collapsed subtrees are excluded.
 */
const SMOOTHSTEP_CHILD_THRESHOLD = 4;

const ACTIVE_EDGE_STYLE = {
  stroke: "var(--primary)",
  strokeWidth: 2.25,
} as const;

export function treeToEdges(
  tree: NavigationTreeJSON | null,
  collapsedNodeIds: Set<NodeId>,
  activePathIds: Set<NodeId>,
): TrailEdge[] {
  if (!tree?.root) return [];

  const edges: TrailEdge[] = [];

  function walk(node: NavigationNodeJSON): void {
    if (collapsedNodeIds.has(node.id)) return;

    const useSmoothStep = node.children.length >= SMOOTHSTEP_CHILD_THRESHOLD;

    for (const child of node.children) {
      const onPath = activePathIds.has(node.id) && activePathIds.has(child.id);
      const edge: TrailEdge = {
        id: `${node.id}->${child.id}`,
        source: String(node.id),
        target: String(child.id),
        type: useSmoothStep ? "smoothstep" : "default",
      };
      if (onPath) {
        edge.style = ACTIVE_EDGE_STYLE;
        edge.zIndex = 1;
      }
      edges.push(edge);
      walk(child);
    }
  }

  walk(tree.root);
  return edges;
}
