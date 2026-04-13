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
  tabCount: number;
  childCount: number;
  isCollapsed: boolean;
  /** Handle IDs this node needs (e.g. ["source-bottom", "target-top"]) — set by layout */
  handles: string[];
};

// ── React Flow node/edge aliases ───────────────────────────────────

export type TrailNode = Node<TrailNodeData, "trail">;
export type TrailEdge = Edge;

// ── Layout modes (mirrors settings.layout.mode) ────────────────────

export type LayoutMode = "tree" | "mindmap" | "radial";

// ── Main graph component props ─────────────────────────────────────

export type TrailGraphProps = {
  tree: NavigationTreeJSON | null;
  currentNodeId: NodeId | null;
  openNodeIds: Set<NodeId>;
  collapsedNodeIds: Set<NodeId>;
  selectedNodeIds: Set<NodeId>;
  nodeTabCounts: Record<NodeId, number>;
  settings: Settings;
  onNodeClick: (nodeId: NodeId, url: string) => void;
  onNodeContextMenu: (
    nodeId: NodeId,
    position: { x: number; y: number },
  ) => void;
  onCollapseToggle: (nodeId: NodeId) => void;
  onSelectionChange: (nodeIds: Set<NodeId>) => void;
  onLayoutModeChange: (mode: LayoutMode) => void;
};

// ── Layout computation result ──────────────────────────────────────

export type LayoutResult = {
  nodes: TrailNode[];
  edges: TrailEdge[];
};
