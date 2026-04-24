import type { Node, Edge } from "@xyflow/react";
import type { NodeId, Url, Title, FaviconUrl } from "@shared/types/ids.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { Settings } from "@shared/types/settings.js";

// ── Node data carried by each React Flow node ──────────────────────

export type TrailNodeData = {
  nodeId: NodeId;
  url: Url;
  title: Title;
  favicon?: FaviconUrl;
  pinned: boolean;
  isCurrent: boolean;
  isOpen: boolean;
  /** True for the current node and all its ancestors up to the root */
  onActivePath: boolean;
  tabCount: number;
  childCount: number;
  isCollapsed: boolean;
  /**
   * Number of chain ancestors auto-hidden by the collapselist fold.
   * Zero means the node is not a folded tip. When positive, renders a
   * "+N" badge and double-click unfolds the chain in place.
   */
  foldedAncestorCount: number;
  /** Handle IDs this node needs (e.g. ["source-bottom", "target-top"]) — set by layout */
  handles: string[];
  /**
   * Onboarding tour spotlight. "pulse" = soft radiating ring, used on
   * nodes the coach is narrating about. "target" = persistent ring +
   * arrow, used to invite a click. Absent on every other node.
   * Layout merges this from the Zustand `onboarding.spotlight` slice.
   */
  spotlight?: "pulse" | "target";
};

// ── React Flow node/edge aliases ───────────────────────────────────

export type TrailNode = Node<TrailNodeData, "trail">;
export type TrailEdge = Edge;

// ── Layout modes (mirrors settings.layout.mode) ────────────────────

export type LayoutMode = "tree" | "mindmap";

// ── Main graph component props ─────────────────────────────────────

export type TrailGraphProps = {
  tree: NavigationTreeJSON | null;
  currentNodeId: NodeId | null;
  openNodeIds: Set<NodeId>;
  collapsedNodeIds: Set<NodeId>;
  /** Tip IDs the user has manually unfolded (skips chain folding for those chains). */
  unfoldedChainIds: Set<NodeId>;
  selectedNodeIds: Set<NodeId>;
  nodeTabCounts: Record<NodeId, number>;
  settings: Settings;
  precomputedPositions?: Record<string, { x: number; y: number }> | null;
  /**
   * Optional onboarding spotlight: single node highlighted with a pulse
   * or target ring. Layout doesn't re-run when this changes — only the
   * matched node's data is shallow-cloned.
   */
  spotlight?: { nodeId: NodeId | null; kind: "pulse" | "target" | null } | null;
  onNodeClick: (nodeId: NodeId, url: string) => void;
  onNodeContextMenu: (nodeId: NodeId, position: { x: number; y: number }) => void;
  onCollapseToggle: (nodeId: NodeId) => void;
  /** Toggle manual unfold for a chain-fold tip (by tip node ID). */
  onChainUnfoldToggle: (nodeId: NodeId) => void;
  onSelectionChange: (nodeIds: Set<NodeId>) => void;
};

// ── Layout computation result ──────────────────────────────────────

export type LayoutResult = {
  nodes: TrailNode[];
  edges: TrailEdge[];
};
