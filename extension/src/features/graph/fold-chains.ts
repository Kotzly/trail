/**
 * Chain folding for collapselist-matching sites.
 *
 * Some sites (translate.yandex.ru, live-search apps) change their URL
 * on nearly every keystroke, producing long linear runs of nodes in
 * the navigation tree. They don't want to be *blocked* — the user
 * still wants to know they used the site and what the final URL was —
 * but the intermediate "transition" nodes drown out the rest of the
 * trail.
 *
 * This transform detects **chains**: maximal linear sequences
 * `n1 → n2 → … → nk` where every node matches the collapselist, each
 * non-tip has exactly one child (so there's no branching inside the
 * chain), and that single child also matches. The tip (`nk`) is the
 * most recent visible URL; `n1 … n(k-1)` are hidden from the graph
 * and counted on the tip as `foldedAncestorCount`.
 *
 * The tree data is never mutated — this is a pure view transform. The
 * user can remove a pattern from the collapselist to see everything
 * again, or double-click a folded tip to temporarily unfold just that
 * chain (tracked separately in `unfoldedTipIds`).
 *
 * Edge rewiring: when a chain is folded, the incoming edge to the
 * chain head's parent is redirected to the tip, so the graph stays
 * connected. Chain-internal edges are dropped.
 */

import type { NodeId } from "@shared/types/ids.js";
import type { NavigationNodeJSON } from "@shared/types/node.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { UrlPredicate } from "@shared/lib/url-blocklist.js";

export type ChainFoldInfo = {
  /** Node IDs hidden from rendering (every chain member except the tip). */
  readonly hiddenIds: ReadonlySet<NodeId>;
  /** Tip node ID → number of folded ancestors (chain length - 1). */
  readonly tipFoldCounts: ReadonlyMap<NodeId, number>;
  /**
   * Chain-head node → tip node. Used by edge rewiring and d3 layout:
   * a parent treats a chain-head child as if it were the tip (visually
   * skipping past the hidden intermediates).
   */
  readonly headToTip: ReadonlyMap<NodeId, NavigationNodeJSON>;
  /**
   * Tips of chains the user has manually unfolded (double-click). The
   * chain's nodes render as normal, and double-clicking the tip again
   * re-folds it. Populated even though the chain is NOT currently
   * hidden, so the UI can show a "refold" affordance.
   */
  readonly unfoldedTipIds: ReadonlySet<NodeId>;
};

export const EMPTY_FOLD_INFO: ChainFoldInfo = {
  hiddenIds: new Set<NodeId>(),
  tipFoldCounts: new Map<NodeId, number>(),
  headToTip: new Map<NodeId, NavigationNodeJSON>(),
  unfoldedTipIds: new Set<NodeId>(),
};

/**
 * Walk the tree and produce the fold plan.
 *
 * `unfoldedTipIds` lets the user opt out of folding for specific
 * chains (e.g. by double-clicking the tip). A tip in this set stays
 * fully expanded: the whole chain renders as normal parent→child
 * nodes.
 *
 * Pinned chain members are also respected — if a chain contains any
 * pinned node, the chain is NOT folded (pin = "this one matters",
 * overrides the default auto-hide).
 */
export function computeChainFoldInfo(
  tree: NavigationTreeJSON | null,
  matches: UrlPredicate,
  userUnfoldedIds: ReadonlySet<NodeId> = new Set<NodeId>(),
): ChainFoldInfo {
  if (!tree?.root) return EMPTY_FOLD_INFO;

  const hiddenIds = new Set<NodeId>();
  const tipFoldCounts = new Map<NodeId, number>();
  const headToTip = new Map<NodeId, NavigationNodeJSON>();
  const unfoldedTipIds = new Set<NodeId>();

  function walkFromHead(head: NavigationNodeJSON): NavigationNodeJSON {
    // Follow the linear chain: while current has exactly one child and
    // that child also matches, step into it. Stop at the tip.
    const members: NavigationNodeJSON[] = [head];
    let current = head;
    while (current.children.length === 1) {
      const child = current.children[0]!;
      if (!matches(child.data.url)) break;
      members.push(child);
      current = child;
    }

    const tip = members[members.length - 1]!;

    // Pin override: if any chain member is pinned, leave the chain
    // fully visible. The user has explicitly signalled these URLs
    // matter — don't hide them.
    const anyPinned = members.some((n) => n.data.pinned);
    const tipUnfolded = userUnfoldedIds.has(tip.id);

    if (members.length > 1 && !anyPinned) {
      if (tipUnfolded) {
        // Chain would fold but the user explicitly unfolded the tip.
        // Expose that to the UI so double-click can re-fold.
        unfoldedTipIds.add(tip.id);
      } else {
        for (let i = 0; i < members.length - 1; i += 1) {
          hiddenIds.add(members[i]!.id);
        }
        tipFoldCounts.set(tip.id, members.length - 1);
        headToTip.set(head.id, tip);
      }
    }

    return tip;
  }

  function walk(
    node: NavigationNodeJSON,
    parentMatched: boolean,
    parentHasOneChild: boolean,
  ): void {
    const nodeMatched = matches(node.data.url);
    // `isChainContinuation`: this node is inside an already-started
    // chain because its parent matched and had only this child. We
    // skip the recursion — its parent's walkFromHead already covered
    // this node.
    const isChainContinuation = nodeMatched && parentMatched && parentHasOneChild;

    let effective: NavigationNodeJSON = node;
    if (nodeMatched && !isChainContinuation) {
      // Start a chain here; walkFromHead may advance past this node
      // and return the tip, whose children we recurse into.
      effective = walkFromHead(node);
    }

    // Recurse into effective's children. For a chain tip,
    // `effective.children` are the tip's children (outside the chain).
    // For a non-matching node, `effective === node`.
    const childCount = effective.children.length;
    const effectiveMatched = matches(effective.data.url);
    const hasOneChild = childCount === 1;
    for (const child of effective.children) {
      walk(child, effectiveMatched, hasOneChild);
    }
  }

  walk(tree.root, false, false);
  return { hiddenIds, tipFoldCounts, headToTip, unfoldedTipIds };
}
