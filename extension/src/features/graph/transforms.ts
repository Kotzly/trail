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
import { type ChainFoldInfo, EMPTY_FOLD_INFO } from "./fold-chains.js";

export type TreeToNodesMetadata = {
  currentNodeId: NodeId | null;
  openNodeIds: Set<NodeId>;
  nodeTabCounts: Record<NodeId, number>;
  collapsedNodeIds: Set<NodeId>;
  /** Nodes expanded via the `+N` badge — drives the re-collapse arrow. Optional; defaults to empty. */
  badgeExpandedIds?: Set<NodeId>;
  /** Node currently being renamed inline. Optional; null/absent = no inline rename. */
  inlineRenameTargetId?: NodeId | null;
};

const EMPTY_BADGE_EXPANDED: Set<NodeId> = new Set();

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
 * Chain-folded ancestors are excluded entirely; their tip gets `foldedAncestorCount`.
 */
export function treeToNodes(
  tree: NavigationTreeJSON | null,
  metadata: TreeToNodesMetadata,
  activePathIds?: Set<NodeId>,
  foldInfo: ChainFoldInfo = EMPTY_FOLD_INFO,
): TrailNode[] {
  if (!tree?.root) return [];

  const path = activePathIds ?? computeActivePathIds(tree, metadata.currentNodeId);
  const nodes: TrailNode[] = [];

  function walk(node: NavigationNodeJSON): void {
    // Hidden chain member: skip entirely, but still recurse (its only
    // child will itself be either hidden or the tip — both reached via
    // normal recursion).
    if (foldInfo.hiddenIds.has(node.id)) {
      for (const child of node.children) walk(child);
      return;
    }

    const isCollapsed = metadata.collapsedNodeIds.has(node.id);
    const badgeIds = metadata.badgeExpandedIds ?? EMPTY_BADGE_EXPANDED;
    const wasExpandedViaBadge = !isCollapsed && badgeIds.has(node.id);
    const foldedAncestorCount = foldInfo.tipFoldCounts.get(node.id) ?? 0;
    const isChainUnfolded = foldInfo.unfoldedTipIds.has(node.id);

    const data = {
      nodeId: node.id,
      url: node.data.url,
      title: node.data.title,
      pinned: node.data.pinned,
      isCurrent: node.id === metadata.currentNodeId,
      isOpen: metadata.openNodeIds.has(node.id),
      onActivePath: path.has(node.id),
      tabCount: metadata.nodeTabCounts[node.id] ?? 0,
      childCount: node.children.length,
      isCollapsed,
      wasExpandedViaBadge,
      foldedAncestorCount,
      isChainUnfolded,
      isRenaming: metadata.inlineRenameTargetId === node.id,
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

const ACTIVE_EDGE_STYLE = Object.freeze({
  stroke: "var(--primary)",
  strokeWidth: 2.25,
});

/**
 * Base edge list — topology only, no active-path styling.
 * Styling is applied on top (see `applyEdgeHighlight`) so the base list
 * can be cached across active-tab changes.
 */
export function treeToEdges(
  tree: NavigationTreeJSON | null,
  collapsedNodeIds: Set<NodeId>,
  foldInfo: ChainFoldInfo = EMPTY_FOLD_INFO,
): TrailEdge[] {
  if (!tree?.root) return [];

  const edges: TrailEdge[] = [];

  function walk(node: NavigationNodeJSON): void {
    if (collapsedNodeIds.has(node.id)) return;
    // Hidden chain member: skip its own outgoing edges (children are
    // either hidden too or the tip, reached via the rewired edge from
    // the chain head's parent).
    if (foldInfo.hiddenIds.has(node.id)) return;

    const useSmoothStep = node.children.length >= SMOOTHSTEP_CHILD_THRESHOLD;

    for (const child of node.children) {
      // Rewire: if child is a chain head, emit edge to the chain's tip
      // instead. The hidden intermediates still live in the tree data,
      // but visually the graph jumps straight to the latest URL.
      const rewireTip = foldInfo.headToTip.get(child.id);
      if (rewireTip !== undefined) {
        edges.push({
          id: `${node.id}->${rewireTip.id}`,
          source: String(node.id),
          target: String(rewireTip.id),
          type: useSmoothStep ? "smoothstep" : "default",
        });
        // Walk the tip directly — walking `child` (hidden head) would
        // return immediately on the hiddenIds check, and the tip's own
        // outgoing edges (to its non-chain subtree) would be dropped.
        walk(rewireTip);
        continue;
      }

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

/**
 * Produce a fresh edge list with active-path styling applied. Edges not
 * on the active path are returned by reference (no allocation). Edges on
 * the path are shallow-cloned with style + zIndex set.
 */
export function applyEdgeHighlight(
  edges: readonly TrailEdge[],
  activePathIds: Set<NodeId>,
): TrailEdge[] {
  if (activePathIds.size === 0) return edges as TrailEdge[];
  const out: TrailEdge[] = new Array(edges.length);
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i]!;
    const onPath =
      activePathIds.has(edge.source as NodeId) && activePathIds.has(edge.target as NodeId);
    out[i] = onPath ? { ...edge, style: ACTIVE_EDGE_STYLE, zIndex: 1 } : edge;
  }
  return out;
}
