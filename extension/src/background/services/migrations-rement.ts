/**
 * Pure helpers for the v1→v2 `rement_node_ids_uuidv7` migration.
 *
 * Extracted into its own module so the transform can be unit-tested
 * without dragging in `wxt/utils/storage` (which is unavailable in the
 * `node --import tsx` test harness). No side effects, no I/O.
 */

import { uuidv7 } from "@shared/lib/uuid.js";

/**
 * Walk a raw NavigationTreeJSON-shaped object and REPLACE every `id`
 * with a fresh uuidv7. Tree structure (parent/child layout via the
 * children arrays) is preserved; only the identity tokens change.
 *
 * An old→new id map is threaded through the walk so the tree's
 * `currentNodeId` pointer can be rewritten to the new id of the same
 * logical node.
 */
function rementIdsInNodeJSON(node: unknown, idMap: Map<string, string>): void {
  if (!node || typeof node !== "object") return;
  const n = node as { id?: unknown; children?: unknown[] };
  if (n.id !== undefined && n.id !== null) {
    const oldId = String(n.id);
    const newId = uuidv7();
    idMap.set(oldId, newId);
    n.id = newId;
  }
  if (Array.isArray(n.children)) {
    for (const child of n.children) rementIdsInNodeJSON(child, idMap);
  }
}

export function rementIdsInTreeJSON(json: unknown): unknown {
  if (!json || typeof json !== "object") return json;
  const t = json as { root?: unknown; currentNodeId?: unknown };
  const idMap = new Map<string, string>();
  if (t.root) rementIdsInNodeJSON(t.root, idMap);
  if (t.currentNodeId !== undefined && t.currentNodeId !== null) {
    const oldId = String(t.currentNodeId);
    t.currentNodeId = idMap.get(oldId) ?? null;
  }
  return json;
}
