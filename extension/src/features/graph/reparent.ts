/**
 * Drag-to-reparent helpers.
 *
 * Pure functions here; UI lives in `TrailGraph`. The validation rules
 * mirror the backend (`mutation-handlers.ts:REPARENT_NODE`):
 *
 *   • root cannot be reparented
 *   • cannot drop onto self
 *   • cannot drop onto current parent (no-op)
 *   • cannot drop onto a descendant (would create a cycle)
 *
 * Client-side checks give instant visual feedback (valid vs invalid drop
 * target ring); the backend re-validates on commit so a malicious or
 * stale client can't slip past.
 */

import type { NodeId } from "@shared/types/ids.js";
import type { NavigationNodeJSON } from "@shared/types/node.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";

export type TreeMaps = {
  /** Node id → its parent's id, or null for the root. */
  parentMap: Map<NodeId, NodeId | null>;
  rootId: NodeId | null;
};

/** Build parent-pointer + root lookups from a `NavigationTreeJSON`. */
export function buildTreeMaps(tree: NavigationTreeJSON | null): TreeMaps {
  const parentMap = new Map<NodeId, NodeId | null>();
  let rootId: NodeId | null = null;
  if (tree?.root) {
    rootId = tree.root.id;
    const walk = (n: NavigationNodeJSON, parent: NodeId | null) => {
      parentMap.set(n.id, parent);
      for (const c of n.children) walk(c, n.id);
    };
    walk(tree.root, null);
  }
  return { parentMap, rootId };
}

/**
 * True iff dragging `sourceId` onto `candidateId` would be a legal new
 * parent. See module-level comment for the rule list.
 */
export function isValidDropTarget(maps: TreeMaps, sourceId: NodeId, candidateId: NodeId): boolean {
  if (sourceId === candidateId) return false;
  if (maps.rootId === sourceId) return false;
  if (!maps.parentMap.has(sourceId) || !maps.parentMap.has(candidateId)) return false;
  const sourceParent = maps.parentMap.get(sourceId);
  if (sourceParent === candidateId) return false;
  // Walk from candidate up to root; if we encounter source, candidate
  // sits inside source's subtree → a reparent here would be a cycle.
  let cur: NodeId | null | undefined = candidateId;
  while (cur !== null && cur !== undefined) {
    if (cur === sourceId) return false;
    cur = maps.parentMap.get(cur);
  }
  return true;
}
