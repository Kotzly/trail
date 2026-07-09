/**
 * Pure functions for the sync-conflict diff flow.
 *
 * - `diffTrees` classifies every NodeId across local+server payloads and
 *   emits a `TreeDiff` that drives the dialog (Summary tab counts, Trees
 *   tab unified list, flat DFS index for virtualization).
 * - `applyMerge` consumes a `TreeDiff` + user's `ConflictPickState` and
 *   emits a `NavigationTreeJSON` suitable for writing back.
 * - `validateMergedTree` checks post-merge invariants; applyMerge calls
 *   it internally, and the background handler re-runs it pre-upsert.
 *
 * All three functions are pure: no Date.now(), no randomUUID(), no
 * network, no storage. `applyMerge` accepts a `Clock` capability so
 * tests can pin timestamps.
 */

import { isEqual } from "es-toolkit";

import type { NodeId, Tag, Timestamp } from "../types/ids.js";
import type { NavigationNodeJSON, NodeData } from "../types/node.js";
import type { NavigationTreeJSON } from "../types/tree.js";
import type {
  Clock,
  ConflictPickState,
  DiffCounts,
  DiffNode,
  DiffNodeStatus,
  LabelDiff,
  LabelPick,
  LabelSide,
  MergeResult,
  NodeFieldChange,
  StructuralWarning,
  TreeDiff,
} from "../types/tree-diff.js";
import { buildNewTabRootData, isNewTabUrl } from "./root.js";

// ---------------------------------------------------------------------------
// diffTrees
// ---------------------------------------------------------------------------

type IndexEntry = {
  node: NavigationNodeJSON;
  parentId: NodeId | null;
  siblingIndex: number;
  depth: number;
};

type IndexResult = {
  byId: Map<NodeId, IndexEntry>;
  rootId: NodeId | null;
  duplicates: NodeId[];
  nodeCount: number;
};

function indexTree(tree: NavigationTreeJSON): IndexResult {
  const byId = new Map<NodeId, IndexEntry>();
  const duplicates: NodeId[] = [];

  function walk(
    node: NavigationNodeJSON,
    parentId: NodeId | null,
    siblingIndex: number,
    depth: number,
  ): void {
    if (byId.has(node.id)) {
      duplicates.push(node.id);
      // Do NOT recurse into the duplicate subtree — it'd double-count
      // every descendant.
      return;
    }
    byId.set(node.id, { node, parentId, siblingIndex, depth });
    const children = node.children ?? [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child) continue;
      walk(child, node.id, i, depth + 1);
    }
  }

  if (tree.root) walk(tree.root, null, 0, 0);
  return { byId, rootId: tree.root?.id ?? null, duplicates, nodeCount: byId.size };
}

/**
 * Field-level diff on NodeData.
 *
 * - surface: title / favicon / pinned / tags / layout (user-visible).
 * - noise: lastVisitedAt, visitCount, pinnedUpdatedAt, layoutUpdatedAt
 *   (hidden from the dialog by default; still preserved verbatim on merge).
 */
function compareNodeData(
  mine: NodeData,
  theirs: NodeData,
): {
  surface: NodeFieldChange[];
  surfaceChanged: boolean;
} {
  const surface: NodeFieldChange[] = [];

  if (mine.title !== theirs.title) {
    surface.push({ kind: "primitive", field: "title", mine: mine.title, theirs: theirs.title });
  }
  if (mine.favicon !== theirs.favicon) {
    surface.push({
      kind: "primitive",
      field: "favicon",
      mine: mine.favicon,
      theirs: theirs.favicon,
    });
  }
  if (mine.pinned !== theirs.pinned) {
    surface.push({ kind: "primitive", field: "pinned", mine: mine.pinned, theirs: theirs.pinned });
  }
  // Tags as a set — order-independent compare; directional add/remove list.
  if (!arraysEqualAsSet(mine.tags, theirs.tags)) {
    const mineSet = new Set<Tag>(mine.tags);
    const theirsSet = new Set<Tag>(theirs.tags);
    const added: string[] = [];
    const removed: string[] = [];
    for (const t of theirs.tags) if (!mineSet.has(t)) added.push(t);
    for (const t of mine.tags) if (!theirsSet.has(t)) removed.push(t);
    surface.push({
      kind: "tags",
      added,
      removed,
      mine: [...mine.tags],
      theirs: [...theirs.tags],
    });
  }
  if (!isEqual(mine.layout ?? null, theirs.layout ?? null)) {
    surface.push({ kind: "layout", mine: mine.layout, theirs: theirs.layout });
  }

  return { surface, surfaceChanged: surface.length > 0 };
}

function arraysEqualAsSet<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set<T>(a);
  for (const x of b) if (!seen.has(x)) return false;
  return true;
}

/** Walk up the local index to produce the parent chain root → parent. */
function buildLocalParentPath(
  nodeId: NodeId,
  mineIdx: IndexResult,
  wrapperId: NodeId | null,
): NodeId[] {
  const path: NodeId[] = [];
  let cur = mineIdx.byId.get(nodeId)?.parentId ?? null;
  while (cur !== null && cur !== wrapperId) {
    path.unshift(cur);
    cur = mineIdx.byId.get(cur)?.parentId ?? null;
  }
  return path;
}

type Classification = {
  id: NodeId;
  status: DiffNodeStatus;
  mine: NavigationNodeJSON | null;
  theirs: NavigationNodeJSON | null;
  fields: NodeFieldChange[];
  movedFromPath?: NodeId[];
  parentDeletedOn?: "mine" | "theirs";
  canonicalParent: NodeId | null;
  serverSiblingIndex: number | null;
  mineSiblingIndex: number | null;
  depth: number;
};

const INITIAL_COUNTS: DiffCounts = {
  unchanged: 0,
  added: 0,
  removed: 0,
  modified: 0,
  moved: 0,
  reordered: 0,
  corrupt: 0,
};

export function diffTrees(
  local: NavigationTreeJSON,
  server: NavigationTreeJSON,
  labelMeta: { mine: LabelSide; theirs: LabelSide },
  opts: { treeId: string; serverUpdatedAt: string },
): TreeDiff {
  const mineIdx = indexTree(local);
  const theirsIdx = indexTree(server);
  const corruptReasons: string[] = [];

  if (mineIdx.duplicates.length > 0) {
    corruptReasons.push(`duplicate NodeId on mine: ${mineIdx.duplicates[0]}`);
  }
  if (theirsIdx.duplicates.length > 0) {
    corruptReasons.push(`duplicate NodeId on theirs: ${theirsIdx.duplicates[0]}`);
  }
  if (local.nodeCount !== mineIdx.nodeCount) {
    corruptReasons.push(
      `nodeCount mismatch on mine: declared ${local.nodeCount}, walked ${mineIdx.nodeCount}`,
    );
  }
  if (server.nodeCount !== theirsIdx.nodeCount) {
    corruptReasons.push(
      `nodeCount mismatch on theirs: declared ${server.nodeCount}, walked ${theirsIdx.nodeCount}`,
    );
  }

  // Detect each side's NTP wrapper. The wrapper id differs per device
  // (see ensureNtpRoot in mapper.ts) so we collapse both wrappers into
  // a synthetic root DiffNode and classify the NTP wrapper id itself
  // as an implementation detail — not a user-visible node.
  const mineWrapperId: NodeId | null =
    local.root && isNewTabUrl(local.root.data.url) ? local.root.id : null;
  const theirsWrapperId: NodeId | null =
    server.root && isNewTabUrl(server.root.data.url) ? server.root.id : null;

  const canonParent = (parentId: NodeId | null): NodeId | null => {
    if (parentId === null) return null;
    if (parentId === mineWrapperId) return null;
    if (parentId === theirsWrapperId) return null;
    return parentId;
  };

  // Union of non-wrapper ids.
  const allIds = new Set<NodeId>();
  for (const id of mineIdx.byId.keys()) if (id !== mineWrapperId) allIds.add(id);
  for (const id of theirsIdx.byId.keys()) if (id !== theirsWrapperId) allIds.add(id);

  const classifications = new Map<NodeId, Classification>();

  for (const id of allIds) {
    const m = mineIdx.byId.get(id) ?? null;
    const t = theirsIdx.byId.get(id) ?? null;

    let status: DiffNodeStatus;
    const mineNode: NavigationNodeJSON | null = m?.node ?? null;
    const theirsNode: NavigationNodeJSON | null = t?.node ?? null;
    let fields: NodeFieldChange[] = [];
    let movedFromPath: NodeId[] | undefined;
    let parentDeletedOn: "mine" | "theirs" | undefined;
    let canonicalParent: NodeId | null;
    let depth: number;

    if (m && !t) {
      status = "removed";
      canonicalParent = canonParent(m.parentId);
      depth = m.depth;
    } else if (t && !m) {
      status = "added";
      canonicalParent = canonParent(t.parentId);
      depth = t.depth;
    } else if (m && t) {
      if (m.node.data.url !== t.node.data.url) {
        status = "corrupt";
        corruptReasons.push(
          `node ${id}: url differs (mine=${m.node.data.url}, theirs=${t.node.data.url})`,
        );
        canonicalParent = canonParent(t.parentId);
        depth = t.depth;
      } else {
        const mineCanon = canonParent(m.parentId);
        const theirsCanon = canonParent(t.parentId);
        if (mineCanon !== theirsCanon) {
          status = "moved";
          canonicalParent = theirsCanon;
          depth = t.depth;
          movedFromPath = buildLocalParentPath(id, mineIdx, mineWrapperId);
          // Did the OTHER side delete the parent this side has?
          const minePid = m.parentId;
          const theirsPid = t.parentId;
          if (minePid !== null && minePid !== mineWrapperId && !theirsIdx.byId.has(minePid)) {
            parentDeletedOn = "theirs";
          } else if (
            theirsPid !== null &&
            theirsPid !== theirsWrapperId &&
            !mineIdx.byId.has(theirsPid)
          ) {
            parentDeletedOn = "mine";
          }
        } else {
          const cmp = compareNodeData(m.node.data, t.node.data);
          if (cmp.surfaceChanged) {
            status = "modified";
            fields = cmp.surface;
            canonicalParent = theirsCanon;
            depth = t.depth;
          } else if (m.siblingIndex !== t.siblingIndex) {
            status = "reordered";
            canonicalParent = theirsCanon;
            depth = t.depth;
          } else {
            status = "unchanged";
            canonicalParent = theirsCanon;
            depth = t.depth;
          }
        }
      }
    } else {
      continue; // unreachable
    }

    classifications.set(id, {
      id,
      status,
      mine: mineNode,
      theirs: theirsNode,
      fields,
      movedFromPath,
      parentDeletedOn,
      canonicalParent,
      serverSiblingIndex: t?.siblingIndex ?? null,
      mineSiblingIndex: m?.siblingIndex ?? null,
      depth,
    });
  }

  // Group by canonical parent for recursive build.
  const childrenByParent = new Map<NodeId | null, Classification[]>();
  for (const c of classifications.values()) {
    const bucket = childrenByParent.get(c.canonicalParent) ?? [];
    bucket.push(c);
    childrenByParent.set(c.canonicalParent, bucket);
  }

  // Deterministic child order: server-known first (in server order),
  // then mine-only appended (in local order). Within each group, ties
  // broken by NodeId for absolute determinism.
  const orderChildren = (list: Classification[]): Classification[] => {
    return list.slice().sort((a, b) => {
      const aHasServer = a.serverSiblingIndex !== null;
      const bHasServer = b.serverSiblingIndex !== null;
      if (aHasServer && !bHasServer) return -1;
      if (!aHasServer && bHasServer) return 1;
      if (aHasServer && bHasServer) {
        const d = (a.serverSiblingIndex as number) - (b.serverSiblingIndex as number);
        if (d !== 0) return d;
      } else {
        const d = (a.mineSiblingIndex as number) - (b.mineSiblingIndex as number);
        if (d !== 0) return d;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  };

  function buildNode(c: Classification): DiffNode {
    const kidList = orderChildren(childrenByParent.get(c.id) ?? []);
    return {
      id: c.id,
      status: c.status,
      mine: c.mine,
      theirs: c.theirs,
      fields: c.fields,
      movedFromPath: c.movedFromPath,
      parentDeletedOn: c.parentDeletedOn,
      depth: c.depth,
      children: kidList.map(buildNode),
    };
  }

  // Synthetic root: carries the NTP wrapper for both sides. Its id
  // uses theirs' wrapper if present (so the diff is stable across
  // re-runs on the same server payload), else mine's.
  const syntheticRootId: NodeId =
    theirsWrapperId ?? mineWrapperId ?? (`__synthetic-root__` as NodeId);
  const topLevel = orderChildren(childrenByParent.get(null) ?? []);
  const root: DiffNode = {
    id: syntheticRootId,
    status: "unchanged",
    mine: local.root ?? null,
    theirs: server.root ?? null,
    fields: [],
    depth: 0,
    children: topLevel.map(buildNode),
  };

  const counts: DiffCounts = { ...INITIAL_COUNTS };
  const flatIndex: DiffNode[] = [];
  (function walk(n: DiffNode) {
    flatIndex.push(n);
    counts[n.status]++;
    n.children.forEach(walk);
  })(root);
  // The synthetic root is not a user-facing node; don't count it.
  counts.unchanged--;

  const label: LabelDiff = {
    mine: labelMeta.mine,
    theirs: labelMeta.theirs,
    equal:
      labelMeta.mine.label === labelMeta.theirs.label &&
      labelMeta.mine.source === labelMeta.theirs.source,
  };

  return {
    treeId: opts.treeId,
    serverUpdatedAt: opts.serverUpdatedAt,
    label,
    root,
    counts,
    flatIndex,
    corruptReasons,
    currentNodeIds: {
      mine: local.currentNodeId,
      theirs: server.currentNodeId,
    },
  };
}

// ---------------------------------------------------------------------------
// applyMerge
// ---------------------------------------------------------------------------

type NodeDecision =
  | { include: true; use: "mine" | "theirs"; overrideParent?: NodeId | null }
  | { include: false };

function isNodePick(value: unknown): value is "mine" | "theirs" {
  return value === "mine" || value === "theirs";
}

/**
 * Per-status default pick. Principle: preserve user's active work by
 * default; force an explicit pick to discard it.
 */
function defaultNodePick(status: DiffNodeStatus): "mine" | "theirs" {
  switch (status) {
    case "added":
      return "theirs";
    case "removed":
      return "mine";
    case "modified":
    case "moved":
    case "reordered":
    case "unchanged":
      return "mine";
    case "corrupt":
      return "mine"; // actually unused: applyMerge refuses corrupt diffs
  }
}

/**
 * Default label pick: USER source beats AUTO/SYSTEM regardless of
 * timestamp. If both are USER (or neither), newer updatedAt wins;
 * tiebreak = mine.
 */
export function defaultLabelPick(label: LabelDiff): LabelPick {
  const mineUser = label.mine.source === "user";
  const theirsUser = label.theirs.source === "user";
  if (mineUser && !theirsUser) return "mine";
  if (theirsUser && !mineUser) return "theirs";
  if (label.mine.updatedAt > label.theirs.updatedAt) return "mine";
  if (label.theirs.updatedAt > label.mine.updatedAt) return "theirs";
  return "mine";
}

/**
 * Resolve a single DiffNode into an inclusion decision per the user's
 * picks (with principled defaults). `include: false` means the node
 * is dropped from the merged tree; its descendants still get a chance
 * to survive if they have their own include decisions (via orphan
 * re-parenting).
 */
function decideNode(node: DiffNode, picks: ConflictPickState): NodeDecision {
  const sPick = picks.structuralPicks[node.id];

  if (node.status === "moved") {
    if (sPick && sPick.kind === "moved") {
      if (sPick.choose === "skip") return { include: false };
      const use: "mine" | "theirs" = sPick.choose === "mine-parent" ? "mine" : "theirs";
      return { include: true, use };
    }
    if (sPick && sPick.kind === "parent-deleted") {
      if (sPick.choose === "delete-both") return { include: false };
      if (sPick.choose === "restore-pre-move") {
        // Place child at its pre-move parent (the side that still has a
        // parent — whichever is NOT parentDeletedOn). The merged tree's
        // parent will come from the surviving side's data.
        const use: "mine" | "theirs" = node.parentDeletedOn === "mine" ? "theirs" : "mine";
        return { include: true, use };
      }
      // keep-parent: include node (default use=mine, preserves user's intent).
      return { include: true, use: defaultNodePick(node.status) };
    }
    // No explicit structural pick → regular nodePicks / default.
    const explicit = picks.nodePicks[node.id];
    const use = isNodePick(explicit) ? explicit : defaultNodePick(node.status);
    return { include: true, use };
  }

  // Non-structural nodes.
  const explicit = picks.nodePicks[node.id];

  if (node.status === "added") {
    // added node lives on server. Pick=theirs → include; pick=mine →
    // exclude (user doesn't want it locally).
    const chosen = isNodePick(explicit) ? explicit : defaultNodePick(node.status);
    return chosen === "theirs" ? { include: true, use: "theirs" } : { include: false };
  }

  if (node.status === "removed") {
    // Removed lives only locally. pick=mine → resurrect; pick=theirs →
    // confirm delete.
    const chosen = isNodePick(explicit) ? explicit : defaultNodePick(node.status);
    return chosen === "mine" ? { include: true, use: "mine" } : { include: false };
  }

  // modified / reordered / unchanged: always included; data follows pick.
  const chosen = isNodePick(explicit) ? explicit : defaultNodePick(node.status);
  return { include: true, use: chosen };
}

/**
 * Given the decisions map, return a map of nodeId → effective parent in
 * the merged tree. Handles orphan re-parenting: if a node's structural
 * parent is dropped, walk up the diff tree to the nearest included
 * ancestor.
 */
function computeEffectiveParents(
  diff: TreeDiff,
  decisions: Map<NodeId, NodeDecision>,
): { parentOf: Map<NodeId, NodeId | null>; warnings: StructuralWarning[] } {
  const parentOf = new Map<NodeId, NodeId | null>();
  const warnings: StructuralWarning[] = [];

  // Build diffParent map (based on the diff tree's canonical layout —
  // i.e., server's position for "moved" nodes, etc.).
  const diffParent = new Map<NodeId, NodeId | null>();
  (function walk(n: DiffNode, parentId: NodeId | null) {
    diffParent.set(n.id, parentId === diff.root.id ? null : parentId);
    n.children.forEach((c) => walk(c, n.id));
  })(diff.root, null);

  for (const node of diff.flatIndex) {
    if (node === diff.root) continue;
    const dec = decisions.get(node.id);
    if (!dec || !dec.include) continue;

    // If a structural pick moves the node elsewhere, respect it.
    let intendedParent: NodeId | null;

    if (dec.overrideParent !== undefined) {
      intendedParent = dec.overrideParent;
    } else if (node.status === "moved") {
      // The diff tree already placed moved nodes at theirs's position.
      // If the pick was mine-parent, we need to read the mine.data to
      // find the mine parent id.
      if (dec.use === "mine" && node.mine) {
        // Mine's parent id from its original position.
        const minePid = findMineParentId(node);
        intendedParent = minePid;
      } else {
        intendedParent = diffParent.get(node.id) ?? null;
      }
    } else {
      intendedParent = diffParent.get(node.id) ?? null;
    }

    // Orphan check: walk up the diff tree if the intended parent was
    // dropped from the merged tree.
    let cursor: NodeId | null = intendedParent;
    while (cursor !== null) {
      const ancestorDec = decisions.get(cursor);
      if (ancestorDec && ancestorDec.include) break;
      const next = diffParent.get(cursor) ?? null;
      cursor = next;
    }

    if (cursor !== intendedParent) {
      warnings.push({
        nodeId: node.id,
        kind: "reparented-to-surviving-ancestor",
        originalParent: (intendedParent ?? diff.root.id) as NodeId,
        newParent: (cursor ?? diff.root.id) as NodeId,
      });
    }

    parentOf.set(node.id, cursor);
  }

  return { parentOf, warnings };
}

/**
 * Recover the original mine-parent id for a moved node. Rather than
 * re-walking the whole local tree, we stored movedFromPath as the
 * local chain root→parent.
 */
function findMineParentId(node: DiffNode): NodeId | null {
  if (!node.movedFromPath || node.movedFromPath.length === 0) return null;
  return node.movedFromPath[node.movedFromPath.length - 1] ?? null;
}

export function applyMerge(
  diff: TreeDiff,
  picks: ConflictPickState,
  clock: Clock = { now: Date.now },
): MergeResult {
  if (diff.corruptReasons.length > 0) {
    return { ok: false, reason: `cannot merge corrupt diff: ${diff.corruptReasons[0]}` };
  }

  // Phase 1: decide per node.
  const decisions = new Map<NodeId, NodeDecision>();
  for (const node of diff.flatIndex) {
    if (node === diff.root) continue;
    decisions.set(node.id, decideNode(node, picks));
  }

  // Phase 2: resolve parents (with orphan walks).
  const { parentOf, warnings } = computeEffectiveParents(diff, decisions);

  // Phase 3: build parent→children map for emit.
  const childrenByParent = new Map<NodeId | null, NodeId[]>();
  for (const [childId, parent] of parentOf.entries()) {
    const bucket = childrenByParent.get(parent) ?? [];
    bucket.push(childId);
    childrenByParent.set(parent, bucket);
  }

  // Phase 4: order each parent's children. Prefer the picked side's
  // sibling order for the nodes it knows about; the other side's
  // nodes are appended.
  const reorderFor = (parentId: NodeId | null): "mine-order" | "theirs-order" => {
    if (parentId === null) {
      // Root-level reorder pick isn't structural; default to mine.
      return picks.reorderPicks[diff.root.id] ?? "mine-order";
    }
    return picks.reorderPicks[parentId] ?? "mine-order";
  };

  const orderChildren = (parent: NodeId | null): NodeId[] => {
    const ids = childrenByParent.get(parent) ?? [];
    const which = reorderFor(parent);

    // Build a score per id: (primaryOrder, secondaryOrder, id).
    // primary: sibling index from preferred side (if the side has it).
    // secondary: sibling index from other side.
    return ids
      .slice()
      .map((id) => {
        const dec = decisions.get(id);
        // Look up diffNode (O(1) via flatIndex? — use a local map)
        const dn = nodeById.get(id)!;
        const mineIdx = dn.mine ? dn.mine : null;
        const theirsIdx = dn.theirs ? dn.theirs : null;
        // We use the diff tree's captured indices via classifications;
        // but those were pruned. Use movedFromPath for mine index.
        // Simpler: rely on mine/theirs sibling position within the
        // actual JSON arrays. Compute on the fly:
        const mineSib = mineIdx ? findSiblingIndex(mineIdx.id, "mine") : null;
        const theirsSib = theirsIdx ? findSiblingIndex(theirsIdx.id, "theirs") : null;
        const preferred = which === "mine-order" ? mineSib : theirsSib;
        const fallback = which === "mine-order" ? theirsSib : mineSib;
        const primary = preferred ?? Number.POSITIVE_INFINITY;
        const secondary = fallback ?? Number.POSITIVE_INFINITY;
        return { id, primary, secondary, dec };
      })
      .sort((a, b) => {
        if (a.primary !== b.primary) return a.primary - b.primary;
        if (a.secondary !== b.secondary) return a.secondary - b.secondary;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      })
      .map((x) => x.id);
  };

  // Build a lookup from id → diff node for phase 4.
  const nodeById = new Map<NodeId, DiffNode>();
  for (const n of diff.flatIndex) nodeById.set(n.id, n);

  // Sibling lookup: O(children) — small enough in practice.
  function findSiblingIndex(id: NodeId, side: "mine" | "theirs"): number | null {
    const n = nodeById.get(id);
    if (!n) return null;
    const nodeJSON = side === "mine" ? n.mine : n.theirs;
    if (!nodeJSON) return null;
    const parentDiff = parentDiffById.get(id) ?? null;
    const parentJSON =
      parentDiff === null
        ? side === "mine"
          ? diff.root.mine
          : diff.root.theirs
        : side === "mine"
          ? parentDiff.mine
          : parentDiff.theirs;
    if (!parentJSON) return null;
    const kids = parentJSON.children ?? [];
    for (let i = 0; i < kids.length; i++) {
      const kid = kids[i];
      if (kid && kid.id === id) return i;
    }
    return null;
  }

  const parentDiffById = new Map<NodeId, DiffNode | null>();
  (function walkDiff(n: DiffNode, parent: DiffNode | null) {
    if (n !== diff.root) parentDiffById.set(n.id, parent === diff.root ? null : parent);
    n.children.forEach((c) => walkDiff(c, n));
  })(diff.root, null);

  // Phase 5: emit NavigationNodeJSON recursively.
  function emit(id: NodeId): NavigationNodeJSON | null {
    const dec = decisions.get(id);
    if (!dec || !dec.include) return null;
    const dn = nodeById.get(id);
    if (!dn) return null;
    const sourceNode = dec.use === "mine" ? dn.mine : dn.theirs;
    if (!sourceNode) return null;

    const childIds = orderChildren(id);
    const emittedChildren: NavigationNodeJSON[] = [];
    for (const cid of childIds) {
      const child = emit(cid);
      if (child) emittedChildren.push(child);
    }
    return {
      id: sourceNode.id,
      timestamp: sourceNode.timestamp,
      data: cloneNodeData(sourceNode.data),
      children: emittedChildren,
    };
  }

  // Merged root: NTP wrapper, id preferring mine's wrapper, else theirs'.
  const mineWrapper: NavigationNodeJSON | null =
    diff.root.mine && isNewTabUrl(diff.root.mine.data.url) ? diff.root.mine : null;
  const theirsWrapper: NavigationNodeJSON | null =
    diff.root.theirs && isNewTabUrl(diff.root.theirs.data.url) ? diff.root.theirs : null;

  const rootSourceWrapper = mineWrapper ?? theirsWrapper;
  const topChildIds = orderChildren(null);
  const topChildren: NavigationNodeJSON[] = [];
  for (const cid of topChildIds) {
    const child = emit(cid);
    if (child) topChildren.push(child);
  }

  let mergedRoot: NavigationNodeJSON | null;
  if (rootSourceWrapper) {
    mergedRoot = {
      id: rootSourceWrapper.id,
      timestamp: rootSourceWrapper.timestamp,
      data: cloneNodeData(rootSourceWrapper.data),
      children: topChildren,
    };
  } else if (topChildren.length === 0) {
    mergedRoot = null;
  } else {
    // No wrapper on either side but we have children — synthesise a
    // fresh NTP wrapper. Timestamp is the only impure bit; sourced
    // from clock.
    mergedRoot = {
      // Deterministic synthetic id so tests can pin it via clock if
      // needed — but we can't mint a uuidv7 purely. Fall back to a
      // well-known placeholder; NavigationTreeMapper.fromJSON will
      // re-wrap with a fresh id on load.
      id: "__synthetic-root__" as NodeId,
      timestamp: clock.now() as Timestamp,
      data: buildNewTabRootData(),
      children: topChildren,
    };
  }

  // currentNodeId: mine's if its node is still in the merged tree;
  // else first non-NTP descendant (DFS preorder) of mergedRoot; else
  // null.
  const mergedIds = new Set<NodeId>();
  (function collect(n: NavigationNodeJSON | null) {
    if (!n) return;
    mergedIds.add(n.id);
    n.children.forEach(collect);
  })(mergedRoot);

  // currentNodeId resolution: prefer mine's if its node survived the
  // merge; else fall back to first non-NTP descendant of the merged
  // root (DFS preorder); else null. See plan §Algorithm.
  const mineCurrent = diff.currentNodeIds.mine;
  const theirsCurrent = diff.currentNodeIds.theirs;
  let resolvedCurrent: NodeId | null = null;
  if (mineCurrent && mergedIds.has(mineCurrent)) {
    resolvedCurrent = mineCurrent;
  } else if (theirsCurrent && mergedIds.has(theirsCurrent)) {
    resolvedCurrent = theirsCurrent;
  } else if (mergedRoot) {
    let found: NodeId | null = null;
    (function walk(n: NavigationNodeJSON) {
      if (found !== null) return;
      for (const c of n.children) {
        if (!isNewTabUrl(c.data.url)) {
          found = c.id;
          return;
        }
        walk(c);
      }
    })(mergedRoot);
    resolvedCurrent = found;
  }

  const mergedTree: NavigationTreeJSON = {
    root: mergedRoot,
    currentNodeId: resolvedCurrent,
    nodeCount: mergedIds.size,
  };

  // Merged label
  const labelPick = picks.labelPick ?? defaultLabelPick(diff.label);
  const mergedLabel = labelPick === "mine" ? diff.label.mine : diff.label.theirs;

  const validation = validateMergedTree(mergedTree);
  if (!validation.ok) {
    return { ok: false, reason: `validator: ${validation.reason}` };
  }

  return { ok: true, merged: mergedTree, mergedLabel, warnings };
}

function cloneNodeData(d: NodeData): NodeData {
  // Only set optional keys that are actually present — keeps the merged
  // output byte-comparable with what `fromCompact` produces and avoids
  // shipping `undefined`-valued keys over the RPC boundary.
  const out: NodeData = {
    url: d.url,
    title: d.title,
    pinned: d.pinned,
    tags: [...d.tags],
  };
  if (d.favicon !== undefined) out.favicon = d.favicon;
  if (d.pinnedUpdatedAt !== undefined) out.pinnedUpdatedAt = d.pinnedUpdatedAt;
  if (d.lastVisitedAt !== undefined) out.lastVisitedAt = d.lastVisitedAt;
  if (d.visitCount !== undefined) out.visitCount = d.visitCount;
  if (d.layout !== undefined) out.layout = { ...d.layout };
  if (d.layoutUpdatedAt !== undefined) out.layoutUpdatedAt = d.layoutUpdatedAt;
  return out;
}

// ---------------------------------------------------------------------------
// validateMergedTree
// ---------------------------------------------------------------------------

export function validateMergedTree(
  json: NavigationTreeJSON,
): { ok: true } | { ok: false; reason: string } {
  if (json.root === null) {
    if (json.nodeCount !== 0) return { ok: false, reason: "root is null but nodeCount > 0" };
    if (json.currentNodeId !== null)
      return { ok: false, reason: "currentNodeId set on empty tree" };
    return { ok: true };
  }

  const seen = new Set<NodeId>();
  let walked = 0;
  let duplicate: NodeId | null = null;

  function walk(n: NavigationNodeJSON) {
    if (duplicate !== null) return;
    if (seen.has(n.id)) {
      duplicate = n.id;
      return;
    }
    seen.add(n.id);
    walked++;
    for (const c of n.children ?? []) walk(c);
  }
  walk(json.root);

  if (duplicate !== null) return { ok: false, reason: `duplicate NodeId: ${duplicate}` };
  if (walked !== json.nodeCount) {
    return {
      ok: false,
      reason: `nodeCount mismatch: declared ${json.nodeCount}, walked ${walked}`,
    };
  }
  if (!isNewTabUrl(json.root.data.url)) {
    return { ok: false, reason: `root is not an NTP wrapper: url=${json.root.data.url}` };
  }
  if (json.currentNodeId !== null && !seen.has(json.currentNodeId)) {
    return { ok: false, reason: `currentNodeId references missing node: ${json.currentNodeId}` };
  }
  return { ok: true };
}
