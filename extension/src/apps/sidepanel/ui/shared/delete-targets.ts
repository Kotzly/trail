import type { NodeId } from "@shared/types/ids.js";
import { getNode, type TreeIndex } from "../state/tree-index.js";

/**
 * Intent passed to `useDeleteFlow.request`. The hook resolves this
 * through `resolveDeleteTarget` (collapsed-aware promotion) before
 * dispatching the matching RPC.
 */
export type DeleteIntent =
  | { kind: "node"; nodeIds: NodeId[]; recursive: boolean }
  | { kind: "tree"; treeId: string };

export type DeleteSource =
  | "keyboard"
  | "context"
  | "palette"
  | "selection-bar"
  | "trash-icon"
  | "inline";

export type ResolvedNodeIntent = {
  kind: "node";
  nodeIds: NodeId[];
  recursive: boolean;
  /** True iff resolveDeleteTarget upgraded a non-recursive request to
   *  recursive because at least one node was collapsed (its hidden
   *  descendants would otherwise be orphaned/silently kept). */
  promotedFromCollapsed: boolean;
};

export type ResolvedDeleteIntent = ResolvedNodeIntent | { kind: "tree"; treeId: string };

/**
 * Apply collapsed-aware promotion: if ANY of the target nodes is
 * collapsed, force `recursive: true`. Otherwise return the intent
 * unchanged. Tree-kind intents pass through unchanged.
 */
export function resolveDeleteTarget(
  intent: DeleteIntent,
  collapsedNodeIds: ReadonlySet<NodeId>,
): ResolvedDeleteIntent {
  if (intent.kind !== "node") return intent;
  if (intent.recursive) {
    return { ...intent, promotedFromCollapsed: false };
  }
  const anyCollapsed = intent.nodeIds.some((id) => collapsedNodeIds.has(id));
  return {
    kind: "node",
    nodeIds: intent.nodeIds,
    recursive: anyCollapsed,
    promotedFromCollapsed: anyCollapsed,
  };
}

/**
 * Count nodes that will actually be removed for an intent. Used to
 * size the success toast: "Deleted 3 nodes" vs "Deleted 1 + 30 hidden".
 *
 * For node-kind: unique nodes (root → root subtree if recursive,
 * otherwise just the node itself plus children promoted by remove()).
 * For tree-kind: returns 0 (the toast uses the tree label, not a count).
 */
export function countDeletedForIntent(
  idx: TreeIndex,
  intent: ResolvedDeleteIntent,
): { direct: number; hidden: number } {
  if (idx.size === 0 || intent.kind !== "node") return { direct: 0, hidden: 0 };
  const seen = new Set<NodeId>();
  let direct = 0;
  let hidden = 0;

  const addSelf = (id: NodeId) => {
    if (seen.has(id)) return;
    seen.add(id);
    direct += 1;
  };

  const addSubtree = (id: NodeId, isRoot: boolean) => {
    if (seen.has(id)) return;
    seen.add(id);
    if (isRoot) {
      direct += 1;
    } else {
      hidden += 1;
    }
    const node = getNode(idx, id);
    for (const child of node?.children ?? []) {
      addSubtree(child.id, false);
    }
  };

  if (intent.recursive) {
    for (const id of intent.nodeIds) addSubtree(id, true);
  } else {
    for (const id of intent.nodeIds) addSelf(id);
  }
  return { direct, hidden };
}
