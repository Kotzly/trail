import type { NodeId } from "@shared/types/ids.js";
import { getNode, type TreeIndex } from "../state/tree-index.js";

export function getIncludedRootId(idx: TreeIndex, nodeIds: Iterable<NodeId>): NodeId | null {
  const rootId = idx.rootId;
  if (!rootId) return null;
  for (const id of nodeIds) {
    if (id === rootId) return rootId;
  }
  return null;
}

type DeleteScope = "self" | "children" | "subtree";

export function countOpenTabsForDelete(
  idx: TreeIndex,
  nodeIds: Iterable<NodeId>,
  counts: Record<NodeId, number>,
  scope: DeleteScope,
): number {
  if (idx.size === 0) return 0;
  const visited = new Set<NodeId>();
  let total = 0;

  const addSubtree = (id: NodeId) => {
    if (visited.has(id)) return;
    visited.add(id);
    total += counts[id] ?? 0;
    const node = getNode(idx, id);
    for (const child of node?.children ?? []) {
      addSubtree(child.id);
    }
  };

  for (const id of nodeIds) {
    if (scope === "self") {
      if (visited.has(id)) continue;
      visited.add(id);
      total += counts[id] ?? 0;
      continue;
    }
    if (scope === "children") {
      const node = getNode(idx, id);
      for (const child of node?.children ?? []) {
        addSubtree(child.id);
      }
      continue;
    }
    addSubtree(id);
  }
  return total;
}

export function formatTabsClosed(count: number): string | null {
  if (count <= 0) return null;
  return `Closes ${count} open tab${count === 1 ? "" : "s"}`;
}
