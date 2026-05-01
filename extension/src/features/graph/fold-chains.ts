/**
 * Subtree folding for collapselist-matching sites.
 *
 * Some sites (translate.yandex.ru, live-search apps) change their URL
 * on nearly every keystroke, producing long runs of nodes in the
 * navigation tree. They don't want to be *blocked* — the user still
 * wants to know they used the site and what the final URL was — but
 * the intermediate "transition" nodes drown out the rest of the trail.
 *
 * This transform detects **matching components**: maximal connected
 * subtrees where every node's URL matches the collapselist. Inside a
 * component, "internal" nodes (every child also matches, has at least
 * one child) are hidden; "tip" nodes (no children OR at least one
 * non-matching child) stay visible.
 *
 * Fork support: a chain that branches partway through (user types,
 * backspaces, retypes a different sequence — common with translator
 * sites) still folds. The component may have multiple tips, one per
 * branch. The chain head's incoming edge is rewired to all tips.
 *
 * The tree data is never mutated — this is a pure view transform. The
 * user can remove a pattern from the collapselist to see everything
 * again, or double-click a folded tip to temporarily unfold just that
 * component (tracked separately in `unfoldedTipIds`).
 *
 * Edge rewiring: when a component is folded, the incoming edge to the
 * chain head's parent is redirected to the tip(s), so the graph stays
 * connected. Internal edges are dropped.
 */

import type { NodeId } from "@shared/types/ids.js";
import type { NavigationNodeJSON } from "@shared/types/node.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { UrlPredicate } from "@shared/lib/url-blocklist.js";

export type ChainFoldInfo = {
  /** Node IDs hidden from rendering (every internal component member). */
  readonly hiddenIds: ReadonlySet<NodeId>;
  /** Tip node ID → number of folded ancestors immediately above the tip. */
  readonly tipFoldCounts: ReadonlyMap<NodeId, number>;
  /**
   * Hidden-internal node ID → list of visible tips it should be
   * rewired to. Used by edge wiring (treeToEdges) and d3 layout
   * (tree-layout): when a visible parent has a hidden child, treat
   * that child as if it were the listed tip(s).
   *
   * Conceptually for the head: head.id → first-tips of the component.
   * But every hidden internal gets an entry — handy for nested cases
   * where a visible mid-component tip has hidden matching children.
   */
  readonly headToTips: ReadonlyMap<NodeId, ReadonlyArray<NavigationNodeJSON>>;
  /**
   * Tips of components the user has manually unfolded (double-click).
   * The component renders normally; double-clicking the tip again
   * re-folds it. Populated even though the chain is NOT currently
   * hidden, so the UI can show a "refold" affordance.
   */
  readonly unfoldedTipIds: ReadonlySet<NodeId>;
};

export const EMPTY_FOLD_INFO: ChainFoldInfo = {
  hiddenIds: new Set<NodeId>(),
  tipFoldCounts: new Map<NodeId, number>(),
  headToTips: new Map<NodeId, ReadonlyArray<NavigationNodeJSON>>(),
  unfoldedTipIds: new Set<NodeId>(),
};

/**
 * Walk the tree and produce the fold plan.
 *
 * `unfoldedTipIds` lets the user opt out of folding for specific
 * components (e.g. by double-clicking any tip). If any tip of a
 * component is in this set, the whole component stays expanded and
 * every tip is exposed in the result so the UI can offer a refold
 * affordance.
 *
 * Pinned component members are also respected — if any matching node
 * in the component is pinned, the component is NOT folded (pin =
 * "this one matters", overrides the default auto-hide).
 */
export function computeChainFoldInfo(
  tree: NavigationTreeJSON | null,
  matches: UrlPredicate,
  userUnfoldedIds: ReadonlySet<NodeId> = new Set<NodeId>(),
): ChainFoldInfo {
  if (!tree?.root) return EMPTY_FOLD_INFO;

  const hiddenIds = new Set<NodeId>();
  const tipFoldCounts = new Map<NodeId, number>();
  const headToTips = new Map<NodeId, ReadonlyArray<NavigationNodeJSON>>();
  const unfoldedTipIds = new Set<NodeId>();

  // A matching node is "internal" iff it has children and every child
  // also matches. Otherwise (no children, OR at least one non-matching
  // child) it's a "tip" — kept visible because hiding it would either
  // lose the leaf or orphan its non-matching subtree.
  function isInternal(node: NavigationNodeJSON): boolean {
    if (node.children.length === 0) return false;
    for (const child of node.children) {
      if (!matches(child.data.url)) return false;
    }
    return true;
  }

  // Process one matching component rooted at `head` (whose parent
  // doesn't match, or which is the tree root). Walk the entire
  // component, collect internals/tips, decide whether to fold, and
  // return every member encountered (so the outer walk can recurse
  // into non-matching descendants of every member).
  function processComponent(head: NavigationNodeJSON): NavigationNodeJSON[] {
    const internalNodes: NavigationNodeJSON[] = [];
    const allMembers: NavigationNodeJSON[] = [];
    const firstTips: NavigationNodeJSON[] = [];
    const tipDepth = new Map<NodeId, number>();
    // For each hidden-internal node, the visible tips reachable
    // beneath it without crossing another visible node. Computed
    // bottom-up during DFS.
    const internalRedirects = new Map<NodeId, NavigationNodeJSON[]>();
    let anyPinned = false;

    // DFS the component. `crossedTip` flips to true once we've passed
    // through a tip — descendants are no longer first-tip candidates.
    // `hiddenAbove` counts consecutive internal ancestors directly
    // above the current node (resets when we cross a visible tip).
    // Returns the visible-tip set reachable from `node` without
    // crossing another visible node (used for `internalRedirects`).
    function dfs(
      node: NavigationNodeJSON,
      hiddenAbove: number,
      crossedTip: boolean,
    ): NavigationNodeJSON[] {
      if (node.data.pinned) anyPinned = true;
      allMembers.push(node);

      if (isInternal(node)) {
        internalNodes.push(node);
        const visibleBelow: NavigationNodeJSON[] = [];
        for (const child of node.children) {
          // Internal => every child matches; recurse with bumped depth.
          const sub = dfs(child, hiddenAbove + 1, crossedTip);
          for (const t of sub) visibleBelow.push(t);
        }
        internalRedirects.set(node.id, visibleBelow);
        return visibleBelow;
      }

      // Tip: visible. Record fold-depth and (if first-tip-path) add to
      // firstTips. Then recurse into matching children with reset
      // depth, crossedTip=true.
      tipDepth.set(node.id, hiddenAbove);
      if (!crossedTip) firstTips.push(node);
      for (const child of node.children) {
        if (matches(child.data.url)) {
          dfs(child, 0, true);
        }
      }
      return [node];
    }

    dfs(head, 0, false);

    // No internals → component is a single matching node (or only
    // tips, e.g. a tip with non-matching children that isn't part of
    // any chain). Nothing to hide.
    if (internalNodes.length === 0) return allMembers;
    if (anyPinned) return allMembers;

    const anyTipUnfolded = firstTips.some((t) => userUnfoldedIds.has(t.id));
    if (anyTipUnfolded) {
      for (const t of firstTips) unfoldedTipIds.add(t.id);
      return allMembers;
    }

    for (const n of internalNodes) {
      hiddenIds.add(n.id);
      const redirects = internalRedirects.get(n.id);
      if (redirects && redirects.length > 0) {
        headToTips.set(n.id, redirects);
      }
    }
    for (const [id, depth] of tipDepth) {
      if (depth > 0) tipFoldCounts.set(id, depth);
    }

    return allMembers;
  }

  // Outer walk: for each matching node whose parent doesn't match,
  // process the component once; then descend into the non-matching
  // subtrees attached to any component member. Non-matching nodes
  // recurse normally.
  function walk(node: NavigationNodeJSON, parentMatched: boolean): void {
    const nodeMatched = matches(node.data.url);
    if (nodeMatched) {
      if (parentMatched) return; // Already handled by enclosing component.
      const members = processComponent(node);
      for (const m of members) {
        for (const child of m.children) {
          if (!matches(child.data.url)) walk(child, false);
        }
      }
      return;
    }
    for (const child of node.children) walk(child, false);
  }

  walk(tree.root, false);
  return { hiddenIds, tipFoldCounts, headToTips, unfoldedTipIds };
}
