/**
 * Structural equality helpers for `TrailNodeData` / `TrailNode`.
 *
 * Two consumers:
 *
 *   1. `useGraphLayout`'s identity-stabilization layer — reuses the
 *      previous render's node refs when the new ones are structurally
 *      identical, so downstream memos (displayNodes / lifecycleNodes /
 *      finalNodes) take fast paths and xyflow's per-node diff hits
 *      the reference-equality shortcut.
 *
 *   2. `TrailNode`'s `React.memo` comparator — same data check, plus
 *      a `selected` prop check (set by the display layer).
 *
 * Keep the field list in sync with `TrailNodeData`. Anything missing
 * here is invisible to React Flow's diff, which silently drops
 * downstream updates.
 */

import type { TrailNode, TrailNodeData } from "./types.js";

/**
 * True iff `a` and `b` are structurally identical at every field
 * `TrailNode`'s render reads. New fields on `TrailNodeData` must be
 * added here.
 *
 * `nodeId` is intentionally omitted: both consumers compare data only
 * after identity has been pinned by the outer node id — `trailNodeEqual`
 * gates this call behind `a.id === b.id`, and `TrailNode`'s `React.memo`
 * comparator only ever receives prev/next from the same component
 * instance. `data.nodeId` always equals `node.id` by construction
 * (see `transforms.ts`), so including it here would be a redundant
 * check.
 */
export function trailNodeDataEqual(a: TrailNodeData, b: TrailNodeData): boolean {
  if (a === b) return true;
  return (
    a.title === b.title &&
    a.url === b.url &&
    a.favicon === b.favicon &&
    a.isCurrent === b.isCurrent &&
    a.isOpen === b.isOpen &&
    a.onActivePath === b.onActivePath &&
    a.pinned === b.pinned &&
    a.tabCount === b.tabCount &&
    a.childCount === b.childCount &&
    a.isCollapsed === b.isCollapsed &&
    a.wasExpandedViaBadge === b.wasExpandedViaBadge &&
    a.foldedAncestorCount === b.foldedAncestorCount &&
    a.isChainUnfolded === b.isChainUnfolded &&
    a.isRenaming === b.isRenaming &&
    a.dragRole === b.dragRole &&
    a.spotlight === b.spotlight &&
    handlesEqual(a.handles, b.handles)
  );
}

/**
 * True iff `a` and `b` have identical id, position, and data. Used by
 * the identity-stabilization layer; if two nodes pass this check, the
 * cached reference is reused.
 */
export function trailNodeEqual(a: TrailNode, b: TrailNode): boolean {
  if (a === b) return true;
  return (
    a.id === b.id &&
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    trailNodeDataEqual(a.data, b.data)
  );
}

function handlesEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
