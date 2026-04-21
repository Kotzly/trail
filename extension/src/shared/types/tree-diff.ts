/**
 * Data types for the sync-conflict diff UI.
 *
 * `diffTrees` produces a `TreeDiff` from two `NavigationTreeJSON` payloads;
 * `applyMerge` consumes the diff plus a `ConflictPickState` (user's
 * per-node cherry-picks) and emits a merged `NavigationTreeJSON` that
 * satisfies the same invariants as any other tree payload.
 *
 * See /Users/iv/.claude/plans/sync-wiggly-hellman.md for the full spec.
 */

import type { NodeId } from "./ids.js";
import type { NavigationNodeJSON, NodeData } from "./node.js";
import type { NavigationTreeJSON, TreeLabelSource } from "./tree.js";
import type { CompactTreeJSON } from "./compact-tree.js";

// ---------------------------------------------------------------------------
// Per-node diff state
// ---------------------------------------------------------------------------

export type DiffNodeStatus =
  | "unchanged"
  | "added" // server-only (green)
  | "removed" // local-only (red)
  | "modified" // same id on both sides, NodeData differs (amber)
  | "moved" // same id on both sides, different parent → structural pick
  | "reordered" // same parent, different sibling index (subtle)
  | "corrupt"; // same id, incompatible invariants (e.g. different url) — blocks apply

export type PrimitiveFieldName = "title" | "favicon" | "pinned";

export type NodeFieldChange =
  | { kind: "primitive"; field: PrimitiveFieldName; mine: unknown; theirs: unknown }
  | { kind: "tags"; added: string[]; removed: string[]; mine: string[]; theirs: string[] }
  | { kind: "layout"; mine: NodeData["layout"]; theirs: NodeData["layout"] };

/**
 * User's explicit decision for structural conflicts that can't be
 * resolved by a simple mine/theirs data toggle.
 */
export type StructuralPick =
  | {
      kind: "moved";
      /**
       * Where the node should live in the merged tree.
       * `skip` drops the node (and its descendants reached only via
       * this node) entirely.
       */
      choose: "mine-parent" | "theirs-parent" | "skip";
    }
  | {
      kind: "parent-deleted";
      /**
       * One side moved X under a parent P that the other side deleted.
       * - keep-parent: restore P (and thus X under P).
       * - delete-both: drop P and X.
       * - restore-pre-move: keep P deleted; put X back under its
       *   pre-move parent (from the side that retained it).
       */
      choose: "keep-parent" | "delete-both" | "restore-pre-move";
    };

/** One entry in the diff tree. */
export type DiffNode = {
  id: NodeId;
  status: DiffNodeStatus;

  /** Non-null iff status ≠ "added". */
  mine: NavigationNodeJSON | null;
  /** Non-null iff status ≠ "removed". */
  theirs: NavigationNodeJSON | null;

  /** Non-empty only for status === "modified" (user-visible fields). */
  fields: NodeFieldChange[];

  /**
   * For status === "moved": the local parent chain root→parent.
   * Useful for rendering "moved from Home / Kyoto" breadcrumbs.
   */
  movedFromPath?: NodeId[];

  /** Non-null when the other side deleted this node's parent. */
  parentDeletedOn?: "mine" | "theirs";

  /** Depth from the synthetic root, 0-indexed (synthetic root = 0). */
  depth: number;

  /**
   * Merged-children union for rendering. Server children come first in
   * server order; local-only (removed) children appended in local order.
   * This order is deterministic and covered by a unit test — see
   * `interleaveChildren` in lib/tree-diff.ts.
   */
  children: DiffNode[];
};

// ---------------------------------------------------------------------------
// Label diff
// ---------------------------------------------------------------------------

export type LabelSide = {
  label: string;
  source: TreeLabelSource;
  updatedAt: number;
};

export type LabelDiff = {
  mine: LabelSide;
  theirs: LabelSide;
  equal: boolean;
};

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export type DiffCounts = Record<DiffNodeStatus, number>;

// ---------------------------------------------------------------------------
// Full diff output
// ---------------------------------------------------------------------------

export type TreeDiff = {
  treeId: string;
  /** Snapshotted at preview fetch; used for optimistic concurrency. */
  serverUpdatedAt: string;

  label: LabelDiff;
  /**
   * Synthetic "unchanged" root wrapping the NTP wrapper node. Cross-device
   * NTP-wrapper ids differ but semantically collapse to one root; see
   * `diffTrees` step 2.
   */
  root: DiffNode;
  counts: DiffCounts;
  /** DFS preorder; drives Summary jump-links and virtualization. */
  flatIndex: DiffNode[];
  /** Populated when any node has status "corrupt" or invariant violated. */
  corruptReasons: string[];
  /**
   * Carried from the input NavigationTreeJSON.currentNodeId on each side
   * so `applyMerge` can preserve the right cursor post-merge.
   */
  currentNodeIds: {
    mine: NodeId | null;
    theirs: NodeId | null;
  };
};

// ---------------------------------------------------------------------------
// Picks
// ---------------------------------------------------------------------------

export type NodePick = "mine" | "theirs";
export type LabelPick = "mine" | "theirs";

/**
 * User's resolution state for a single `(treeId, serverUpdatedAt)` pair.
 * Persisted in `chrome.storage.session` keyed by `treeId`; invalidated
 * when `serverUpdatedAt` changes.
 */
export type ConflictPickState = {
  treeId: string;
  serverUpdatedAt: string;
  /** Missing entries fall back to per-status defaults in `applyMerge`. */
  nodePicks: Record<NodeId, NodePick>;
  /** Missing entries use the per-status structural default. */
  structuralPicks: Record<NodeId, StructuralPick>;
  /** null = use default (user-source > newer timestamp, tiebreak mine). */
  labelPick: LabelPick | null;
  /**
   * Per-parent-nodeId decision for `reordered` siblings: whose child
   * order wins. Defaults to mine.
   */
  reorderPicks: Record<NodeId, "mine-order" | "theirs-order">;
};

// ---------------------------------------------------------------------------
// Preview (RPC payload)
// ---------------------------------------------------------------------------

export type ConflictPreview = {
  treeId: string;
  serverPayload: NavigationTreeJSON;
  serverLabel: LabelSide;
  serverUpdatedAt: string;
  serverDeviceId: string;
  /** True iff the server row has deleted_at set; UI shows resurrect/delete flow. */
  isSoftDeleted: boolean;
};

/**
 * On-wire version of ConflictPreview. The tree payload is encoded to
 * `CompactTreeJSON` (tuple-based, gzip-friendly) to keep the
 * structured-clone cost down on the RPC hop.
 */
export type CompressedConflictPreview = Omit<ConflictPreview, "serverPayload"> & {
  serverPayloadCompact: CompactTreeJSON;
};

// ---------------------------------------------------------------------------
// Errors (RPC result unions — never thrown across the proxy)
// ---------------------------------------------------------------------------

export type ConflictPreviewError =
  | { reason: "network" }
  | { reason: "auth-lost" }
  | { reason: "row-missing" }
  | { reason: "payload-corrupt"; detail: string }
  /** `nodeCount > NODE_CAP`; UI renders reduced-UX fallback. */
  | { reason: "too-large"; nodeCount: number };

export type ApplyError =
  /** TOCTOU: server row's updated_at advanced between preview and apply. */
  | { reason: "server-changed"; latest: CompressedConflictPreview }
  /** Active-tree changed between dialog open and apply. */
  | { reason: "tree-not-active"; activeTreeId: string | null }
  /** `validateMergedTree` rejected the merged payload. */
  | { reason: "invalid-merge"; validatorReason: string }
  /** Server row was soft-deleted between open and apply. */
  | { reason: "row-deleted" }
  /** Offline; queued via pendingSyncOps. */
  | { reason: "offline"; queued: boolean }
  | { reason: "network" };

export type ApplyMode = "merge" | "keep-mine" | "use-server";

export type ApplyOk = {
  mergedUpdatedAt: string;
  diffCounts: DiffCounts;
  mode: ApplyMode;
};

export type ApplyResult = { ok: true; value: ApplyOk } | { ok: false; error: ApplyError };

// ---------------------------------------------------------------------------
// Merge result
// ---------------------------------------------------------------------------

export type StructuralWarning = {
  nodeId: NodeId;
  kind: "reparented-to-surviving-ancestor";
  originalParent: NodeId;
  newParent: NodeId;
};

export type MergeOk = {
  ok: true;
  merged: NavigationTreeJSON;
  mergedLabel: LabelSide;
  warnings: StructuralWarning[];
};

export type MergeFail = { ok: false; reason: string };

export type MergeResult = MergeOk | MergeFail;

export type Clock = { now: () => number };

// ---------------------------------------------------------------------------
// RPC input (background handler)
// ---------------------------------------------------------------------------

export type ApplyConflictMergeInput = {
  treeId: string;
  /** Must match server's current updated_at at apply time. */
  expectedServerUpdatedAt: string;
  /**
   * Non-null when the dialog was opened against the active tree.
   * Handler asserts `activeMeta.id === expectedActiveTreeId` before
   * writing — catches the active-tree-switch-during-dialog race.
   */
  expectedActiveTreeId: string | null;
  /** Compact-encoded merged payload. */
  mergedTreeCompact: CompactTreeJSON;
  mergedLabel: LabelSide;
  mode: ApplyMode;
};

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/**
 * Hard cap on per-tree node count for dialog fidelity. Over this, the
 * dialog falls back to the reduced-UX variant (atomic Keep-mine /
 * Use-server only). Chosen so that initial render stays under 100ms on
 * mid-range hardware with virtualization.
 */
export const CONFLICT_DIALOG_NODE_CAP = 10_000;
