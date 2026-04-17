import { type TreeNode } from "@background/state/tree-node.js";
import type { NodeId, Timestamp, Title, Url, FaviconUrl, Tag } from "./ids.js";

/**
 * Node kind discriminator. Default is "normal" (equivalent to a plain
 * tree node). "burst" marks a container grouping a linear sequence of
 * rapid navigations (feed-scrolling, arrow-key browsing, etc.).
 * "burst-item" marks an entry inside such a container. See
 * docs/cleanup-design.md for the full state machine.
 *
 * Invariant: a burst-item must never have its own children. If a user
 * branches out from a burst item (opens a sub-page, etc.), the item
 * is promoted to "normal" and detached from the container first.
 */
export type NodeKind = "normal" | "burst" | "burst-item";

export type BurstMeta = {
  /** URL-shape template that defines continuity: e.g., "arxiv.org/abs/*". */
  urlTemplate: string;
  /** Unix-ms when the burst first promoted from tentative to in-burst. */
  startedAt: Timestamp;
  /** Unix-ms of the most recently accepted item. Used for seal timeout. */
  lastItemAt: Timestamp;
  /**
   * "open" = still accepting new items.
   * "sealed" = locked; any further nav starts a fresh burst/normal.
   * Monotonic in merge semantics: sealed beats open.
   */
  status: "open" | "sealed";
  /** Auto-generated label: e.g. "arxiv.org · 27 items". Overridable by rename. */
  autoLabel?: string;
};

export type NodeData = {
  readonly url: Url;

  title: Title;
  favicon?: FaviconUrl;
  pinned: boolean;
  /** Timestamp of the most recent pinned-state change. Used for LWW merges. */
  pinnedUpdatedAt?: Timestamp;
  tags: Tag[];
  lastVisitedAt?: Timestamp;
  visitCount?: number;
  layout?: {
    offsetX: number;
    offsetY: number;
  };
  /** Timestamp of the most recent layout change. Used for LWW merges. */
  layoutUpdatedAt?: Timestamp;

  /**
   * Optional kind discriminator. Omitted on legacy nodes — callers
   * treat `undefined` as "normal".
   */
  kind?: NodeKind;

  /** Only meaningful when `kind === "burst"`. */
  burst?: BurstMeta;

  /**
   * Marker timestamp for "this node was restored from the auto-cleanup
   * tombstone store within the last 7 days". UI shows a subtle
   * revival icon; cleared after the window elapses.
   */
  revivedAt?: Timestamp;
};

export type NodeDataPatch = Partial<Omit<NodeData, "url">>;
export type NodeMetaPatch = Pick<NodeData, "title" | "favicon">;

export function updateNodeData(old: NodeData, patch: NodeDataPatch): NodeData {
  const layout = patch.layout
    ? { ...(old.layout ?? { offsetX: 0, offsetY: 0 }), ...patch.layout }
    : old.layout;

  return {
    ...old,
    ...patch,

    favicon: patch.favicon !== undefined ? patch.favicon : old.favicon,

    tags: patch.tags ? [...patch.tags] : old.tags,
    layout,
  } as NodeData;
}

export function updateNodeMeta(old: NodeData, patch: NodeMetaPatch): NodeData {
  return {
    ...old,
    title: patch.title ?? old.title,
    favicon: patch.favicon !== undefined ? patch.favicon : old.favicon,
  } as NodeData;
}

export type TreeNodeJSON<T> = {
  id: NodeId;
  timestamp: Timestamp;

  data: T;

  children: TreeNodeJSON<T>[];
};

export type NavigationNode = TreeNode<NodeData>;

export type NavigationNodeJSON = TreeNodeJSON<NodeData>;
