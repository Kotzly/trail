/**
 * Pure transforms: NavigationTreeJSON → React Flow nodes/edges.
 *
 * These are the data contracts between the tree model and the graph UI.
 * Layout positions are NOT set here — that's handled by layout.ts.
 */

import type { NodeId } from "@shared/types/ids.js";
import type { NavigationNodeJSON } from "@shared/types/node.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { TrailNode, TrailNodeData, TrailEdge } from "./types.js";

export type TreeToNodesMetadata = {
  currentNodeId: NodeId | null;
  openNodeIds: Set<NodeId>;
  nodeTabCounts: Record<NodeId, number>;
  collapsedNodeIds: Set<NodeId>;
};

/**
 * Walk the tree and produce a flat list of TrailNodes.
 * Collapsed subtrees are excluded (the collapsed parent is included but not its children).
 */
export function treeToNodes(
  tree: NavigationTreeJSON | null,
  metadata: TreeToNodesMetadata,
): TrailNode[] {
  if (!tree?.root) return [];

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
      tabCount: metadata.nodeTabCounts[node.id] ?? 0,
      childCount: node.children.length,
      isCollapsed,
    } as TrailNodeData;
    if (node.data.favicon !== undefined) {
      data.favicon = node.data.favicon;
    }

    nodes.push({
      id: String(node.id),
      type: "trail",
      position: { x: 0, y: 0 }, // filled by layout
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

export function treeToEdges(
  tree: NavigationTreeJSON | null,
  collapsedNodeIds: Set<NodeId>,
  layoutMode: "tree" | "mindmap" | "radial" = "tree",
): TrailEdge[] {
  if (!tree?.root) return [];

  const edges: TrailEdge[] = [];

  function walk(node: NavigationNodeJSON): void {
    if (collapsedNodeIds.has(node.id)) return;

    const useSmoothStep =
      layoutMode !== "radial" &&
      node.children.length >= SMOOTHSTEP_CHILD_THRESHOLD;

    for (const child of node.children) {
      edges.push({
        id: `${node.id}->${child.id}`,
        source: String(node.id),
        target: String(child.id),
        type: useSmoothStep ? "smoothstep" : "default",
      });
      walk(child);
    }
  }

  walk(tree.root);
  return edges;
}
