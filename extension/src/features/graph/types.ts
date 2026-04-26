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
   * True iff this node was last expanded via the `+N` badge click
   * (rather than context-menu Expand or double-click). Drives the
   * re-collapse arrow affordance — only the badge-click path offers
   * a quick undo, since other paths are already explicit user intent.
   * Mutually exclusive with `isCollapsed`.
   */
  wasExpandedViaBadge: boolean;
  /**
   * Number of chain ancestors auto-hidden by the collapselist fold.
   * Zero means the node is not a folded tip. When positive, renders a
   * "+N" badge and double-click unfolds the chain in place.
   */
  foldedAncestorCount: number;
  /**
   * True iff this node is the tip of a chain the user has manually
   * unfolded (the chain's members are visible as normal nodes).
   * Enables a "refold" visual affordance + double-click to re-collapse.
   * Mutually exclusive with `foldedAncestorCount > 0`.
   */
  isChainUnfolded: boolean;
  /** Handle IDs this node needs (e.g. ["source-bottom", "target-top"]) — set by layout */
  handles: string[];
  /**
   * True iff this node is currently being renamed inline. Layout merges
   * this from `metadata.inlineRenameTargetId` so the TrailNode swaps the
   * title `<span>` for an `<input>`.
   */
  isRenaming: boolean;
  /**
   * Drag-to-reparent visual role. Set transiently during a drag gesture
   * by `TrailGraph` (not by the layout transform). Drives node styling:
   *   • "source"          — the node being dragged (dim + lift)
   *   • "valid-target"    — drop here will reparent (success ring)
   *   • "invalid-target"  — drop here is rejected (warning ring)
   * Undefined when no drag is in progress.
   */
  dragRole?: "source" | "valid-target" | "invalid-target";
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
  /** Node IDs the user expanded via the `+N` badge — drives the re-collapse arrow. */
  badgeExpandedIds: Set<NodeId>;
  selectedNodeIds: Set<NodeId>;
  nodeTabCounts: Record<NodeId, number>;
  settings: Settings;
  precomputedPositions?: Record<string, { x: number; y: number }> | null;
  /**
   * Most recent collapse / expand / chain-unfold action from the store.
   * Reference identity changes only when a new action is committed; a
   * stable null value means "no recent reshape." Used to trigger a
   * smooth camera follow (PowerPoint-Morph-style) when the topology
   * changes substantially.
   */
  collapseAction?: { kind: "collapse" | "expand"; nodeIds: Set<NodeId> } | null;
  /**
   * Optional onboarding spotlight: single node highlighted with a pulse
   * or target ring. Layout doesn't re-run when this changes — only the
   * matched node's data is shallow-cloned.
   */
  spotlight?: { nodeId: NodeId | null; kind: "pulse" | "target" | null } | null;
  /**
   * Inline-rename target — the node currently rendered with an editable
   * `<input>` instead of the static title. F2 / double-click on title
   * sets it; null otherwise.
   */
  inlineRenameTargetId: NodeId | null;
  onInlineRenameStart: (nodeId: NodeId) => void;
  onInlineRenameCommit: (nodeId: NodeId, title: string) => void;
  onInlineRenameCancel: () => void;
  /** Drag-to-reparent commit. Called when the user drops a node onto a valid new parent. */
  onReparentNode: (nodeId: NodeId, newParentId: NodeId) => void;
  onNodeClick: (nodeId: NodeId, url: string) => void;
  onNodeContextMenu: (nodeId: NodeId, position: { x: number; y: number }) => void;
  onCollapseToggle: (nodeId: NodeId) => void;
  /**
   * Toggle collapse via the `+N` / re-collapse badge. Different from
   * `onCollapseToggle` because this path also marks the node as
   * "expanded via badge" so the re-collapse arrow appears.
   */
  onBadgeCollapseToggle: (nodeId: NodeId) => void;
  /** Toggle manual unfold for a chain-fold tip (by tip node ID). */
  onChainUnfoldToggle: (nodeId: NodeId) => void;
  onSelectionChange: (nodeIds: Set<NodeId>) => void;
};

// ── Layout computation result ──────────────────────────────────────

export type LayoutResult = {
  nodes: TrailNode[];
  edges: TrailEdge[];
};
