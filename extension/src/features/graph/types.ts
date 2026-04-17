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
  /** Handle IDs this node needs (e.g. ["source-bottom", "target-top"]) — set by layout */
  handles: string[];

  /**
   * Burst rendering: `true` when the underlying tree node has
   * `kind === "burst"`. `TrailNode` renders a stacked-card affordance
   * and a click-to-expand ribbon of its children. Burst-item children
   * are suppressed from the graph entirely (they're only visible inside
   * the ribbon).
   */
  isBurst: boolean;
  /** Number of burst-item children, 0 for non-burst nodes. */
  burstItemCount: number;
  /** First-item favicon, used as the container's primary favicon. */
  burstFirstFavicon: FaviconUrl | null;
  /** Burst time span derived from burst meta (null for non-burst). */
  burstSpan: { startMs: number; endMs: number } | null;
  /**
   * Burst-item previews for the expanded ribbon. Empty for non-burst.
   * Only title + favicon + URL are needed for the mini-node card.
   */
  burstItems: Array<{
    nodeId: NodeId;
    url: Url;
    title: Title;
    favicon: FaviconUrl | null;
  }>;
  /**
   * True when the node was revived from a tombstone within the
   * revival-indicator window. The revive icon is only rendered when
   * this flag is set AND detail LOD is active.
   */
  isRevived: boolean;
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
  selectedNodeIds: Set<NodeId>;
  nodeTabCounts: Record<NodeId, number>;
  settings: Settings;
  precomputedPositions?: Record<string, { x: number; y: number }> | null;
  onNodeClick: (nodeId: NodeId, url: string) => void;
  onNodeContextMenu: (nodeId: NodeId, position: { x: number; y: number }) => void;
  onCollapseToggle: (nodeId: NodeId) => void;
  onSelectionChange: (nodeIds: Set<NodeId>) => void;
  onLayoutModeChange: (mode: LayoutMode) => void;
};

// ── Layout computation result ──────────────────────────────────────

export type LayoutResult = {
  nodes: TrailNode[];
  edges: TrailEdge[];
};
