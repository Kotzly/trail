/**
 * Read-only adapter over `NavigationTreeJSON` for the sidepanel.
 *
 * The sidepanel never mutates the tree — every write goes over RPC to
 * the background. Constructing OOP `NavigationTree` / `TreeNode`
 * instances per render was the dominant cost of cold sidepanel open
 * on big trees (Zod safeParse + class allocation per node, twice when
 * the layout-refinement push fires).
 *
 * This module builds, in a single DFS, the minimal set of indexes
 * sidepanel code actually uses:
 *   • `nodeIndex` — `findNodeById` lookups
 *   • `parentIndex` — sibling/parent traversal (useShortcuts arrow nav)
 *   • `pinnedIndex` — replaces `PinnedManager.pinned`
 *   • `rootId`, `currentNodeId`, `size` — top-level accessors
 *
 * `getChildren` reads `node.children` directly off the JSON node; no
 * separate child index is needed.
 */

import type { NavigationNodeJSON } from "@shared/types/node.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { NodeId } from "@shared/types/ids.js";

export type TreeIndex = {
  readonly json: NavigationTreeJSON | null;
  readonly nodeIndex: ReadonlyMap<NodeId, NavigationNodeJSON>;
  readonly parentIndex: ReadonlyMap<NodeId, NodeId>;
  readonly pinnedIndex: ReadonlySet<NodeId>;
  readonly rootId: NodeId | null;
  readonly currentNodeId: NodeId | null;
  readonly size: number;
};

export const EMPTY_TREE_INDEX: TreeIndex = Object.freeze({
  json: null,
  nodeIndex: new Map<NodeId, NavigationNodeJSON>(),
  parentIndex: new Map<NodeId, NodeId>(),
  pinnedIndex: new Set<NodeId>(),
  rootId: null,
  currentNodeId: null,
  size: 0,
});

export function buildTreeIndex(json: NavigationTreeJSON | null): TreeIndex {
  if (!json?.root) {
    return json
      ? { ...EMPTY_TREE_INDEX, json, currentNodeId: json.currentNodeId }
      : EMPTY_TREE_INDEX;
  }

  const nodeIndex = new Map<NodeId, NavigationNodeJSON>();
  const parentIndex = new Map<NodeId, NodeId>();
  const pinnedIndex = new Set<NodeId>();

  // Iterative pre-order DFS, left-to-right child order. The reverse-push
  // makes pop() yield the leftmost child first, matching the existing
  // `NavigationTree.iter()` traversal — important for `pinnedIndex`
  // insertion order, which downstream `PinnedDropdown` relies on for a
  // stable visual ordering.
  const stack: NavigationNodeJSON[] = [json.root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    nodeIndex.set(node.id, node);
    if (node.data.pinned) pinnedIndex.add(node.id);
    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      const child = node.children[i]!;
      parentIndex.set(child.id, node.id);
      stack.push(child);
    }
  }

  return {
    json,
    nodeIndex,
    parentIndex,
    pinnedIndex,
    rootId: json.root.id,
    currentNodeId: json.currentNodeId,
    size: nodeIndex.size,
  };
}

export function getNode(idx: TreeIndex, id: NodeId): NavigationNodeJSON | null {
  return idx.nodeIndex.get(id) ?? null;
}

export function getChildren(idx: TreeIndex, id: NodeId): readonly NavigationNodeJSON[] {
  return idx.nodeIndex.get(id)?.children ?? [];
}

export function getParent(idx: TreeIndex, id: NodeId): NavigationNodeJSON | null {
  const parentId = idx.parentIndex.get(id);
  return parentId ? (idx.nodeIndex.get(parentId) ?? null) : null;
}

export function isRoot(idx: TreeIndex, id: NodeId): boolean {
  return idx.rootId !== null && idx.rootId === id;
}

/**
 * DFS pre-order iteration over all nodes. Matches `NavigationTree.iter`
 * ordering (parent before children, children in their stored order)
 * so the pinned-dropdown DFS-order contract is preserved on migration.
 */
export function* iter(idx: TreeIndex): IterableIterator<NavigationNodeJSON> {
  const root = idx.json?.root;
  if (!root) return;
  const stack: NavigationNodeJSON[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    yield node;
    // Push children in reverse so leftmost child comes out next.
    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      stack.push(node.children[i]!);
    }
  }
}
