/**
 * Interactive onboarding tour — step definitions and completion
 * predicates. One source of truth for the coach's sequential logic.
 *
 * The tour is site-agnostic: the "branch parent" is whichever node
 * the user first made into a branching point (i.e. the first node in
 * the tree that acquired ≥1 child). Google, Wikipedia, a blog index,
 * a GitHub repo — all fine. We don't care what they open, only that
 * they exhibit the branch-and-return behavior that makes Trail's
 * model visible.
 *
 * A step is "done" when its `matches(state)` returns true. The
 * observer hook runs predicates on every relevant store change; we
 * intentionally do NOT listen to raw browser events here — the tree
 * model is already the abstraction we want, and observing it keeps
 * the machine pure (unit-testable without a browser).
 */

import type { NodeId } from "@shared/types/ids.js";
import type { NavigationNodeJSON } from "@shared/types/node.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";

export const TOUR_STEPS = [
  "arm",
  "clickResult",
  "goBack",
  "clickAnother",
  "celebrateBranch",
  "returnToAbandoned",
] as const;

export type TourStepId = (typeof TOUR_STEPS)[number];

export const TOUR_STEP_COUNT = TOUR_STEPS.length;

/**
 * Snapshot of the state the machine cares about. Pulled from the
 * Zustand store so the machine stays independent of React.
 */
export type TourStateSnapshot = {
  treeJSON: NavigationTreeJSON | null;
  currentNodeId: NodeId | null;
  /**
   * Id of the FIRST result child created under the branch parent —
   * the "abandoned" node the user will click again on step 5.
   */
  firstResultChildId: NodeId | null;
  /**
   * Id of the node that becomes the branching point once the user
   * clicks a second link from it. Captured once on step 1
   * (clickResult) so all later steps share the same anchor.
   */
  branchParentId: NodeId | null;
};

/**
 * URLs we don't want to count as "real" browsing activity when
 * discovering the branch parent or its children. Extension pages
 * and about: URLs tend to appear as side-effects of normal use
 * (opening settings, the new-tab page) and would otherwise anchor
 * the tour on them instead of on the page the user actually chose.
 */
function isBoringUrl(url: string): boolean {
  return (
    /^chrome-extension:\/\//i.test(url) ||
    /^moz-extension:\/\//i.test(url) ||
    /^about:/i.test(url) ||
    /^chrome:\/\//i.test(url) ||
    /^edge:\/\//i.test(url)
  );
}

/** Walk every node in the tree; short-circuits on `predicate`. */
function findNode(
  tree: NavigationTreeJSON | null,
  predicate: (node: NavigationNodeJSON) => boolean,
): NavigationNodeJSON | null {
  if (!tree?.root) return null;
  const stack: NavigationNodeJSON[] = [tree.root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (predicate(node)) return node;
    for (const child of node.children) stack.push(child);
  }
  return null;
}

/** Count non-boring children of a node (the ones users would think of as "links"). */
export function branchChildren(node: NavigationNodeJSON | null): NavigationNodeJSON[] {
  if (!node) return [];
  return node.children.filter((c) => !isBoringUrl(c.data.url));
}

/**
 * Find the first node (BFS from root) that has at least one
 * non-boring child — the "branch parent". Returns null if the tree
 * has no branching yet. Extension / about pages are skipped as
 * candidates so a stray "settings opened mid-tour" doesn't anchor
 * the tour in the wrong place.
 */
export function findBranchParent(tree: NavigationTreeJSON | null): NavigationNodeJSON | null {
  if (!tree?.root) return null;
  const queue: NavigationNodeJSON[] = [tree.root];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (!isBoringUrl(node.data.url) && branchChildren(node).length >= 1) {
      return node;
    }
    for (const child of node.children) queue.push(child);
  }
  return null;
}

// ── Step predicates ─────────────────────────────────────────────────

export type TourStepPredicate = (state: TourStateSnapshot) => boolean;

/**
 * Step 0 — "arm": user has opened something. Matches as soon as the
 * tour tree contains any non-boring node.
 *
 * IMPORTANT: `NavigationTree` always synthesises a `chrome://newtab/`
 * root (see `@shared/lib/root.buildNewTabRootData`). Real-world
 * navigations attach as CHILDREN of that synthetic root — they never
 * replace it. So "user opened a site" means a non-boring node exists
 * somewhere in the tree, not that the root URL became non-boring.
 */
const armMatches: TourStepPredicate = (s) => {
  if (!s.treeJSON?.root) return false;
  return findNode(s.treeJSON, (n) => !isBoringUrl(n.data.url)) !== null;
};

/**
 * Step 1 — "clickResult": user clicked a link, creating a child
 * node somewhere in the tree. Matched the moment any node in the
 * tree has ≥1 non-boring child — that node becomes the branch
 * parent for the rest of the tour.
 */
const clickResultMatches: TourStepPredicate = (s) => findBranchParent(s.treeJSON) !== null;

/**
 * Step 2 — "goBack": user is back on the branch parent (currentNodeId
 * matches) and a result child still exists (so we know it was a real
 * back-nav, not a delete). Uses `branchParentId` captured on step 1.
 */
const goBackMatches: TourStepPredicate = (s) => {
  if (!s.branchParentId) return false;
  if (s.currentNodeId !== s.branchParentId) return false;
  const parent = findNode(s.treeJSON, (n) => n.id === s.branchParentId);
  return parent !== null && branchChildren(parent).length >= 1;
};

/**
 * Step 3 — "clickAnother": the branch parent now has ≥2 children.
 * The user clicked a second, different link — the tree actually
 * forks.
 */
const clickAnotherMatches: TourStepPredicate = (s) => {
  if (!s.branchParentId) return false;
  const parent = findNode(s.treeJSON, (n) => n.id === s.branchParentId);
  return parent !== null && branchChildren(parent).length >= 2;
};

/**
 * Step 4 — "celebrateBranch": the payoff moment. No predicate —
 * advanced manually by the coach's `[Nice]` button. Keeps the
 * success state visible long enough to feel the reward, instead of
 * auto-advancing on the same tick as the branch detection.
 */
const celebrateBranchMatches: TourStepPredicate = () => false;

/**
 * Step 5 — "returnToAbandoned": user jumps back to the abandoned
 * first child by clicking its node in the graph.
 *
 * Matches in three escalating ways so real-world sloppiness
 * (redirects, rebuilt nodes on tab reopen, id reshuffles) doesn't
 * leave the user stuck after doing exactly what the coach asked:
 *   1. Exact id match.
 *   2. Current is a descendant of the target node.
 *   3. Current node's URL matches the target's URL.
 */
const returnToAbandonedMatches: TourStepPredicate = (s) => {
  if (!s.firstResultChildId) return false;
  if (s.currentNodeId === s.firstResultChildId) return true;
  const target = findNode(s.treeJSON, (n) => n.id === s.firstResultChildId);
  if (!target) return false;

  const descendantHasCurrent = (n: NavigationNodeJSON): boolean => {
    if (n.id === s.currentNodeId) return true;
    for (const child of n.children) {
      if (descendantHasCurrent(child)) return true;
    }
    return false;
  };
  if (target.children.some(descendantHasCurrent)) return true;

  const current = findNode(s.treeJSON, (n) => n.id === s.currentNodeId);
  if (current && current.data.url === target.data.url) return true;

  return false;
};

export const TOUR_STEP_PREDICATES: Record<TourStepId, TourStepPredicate> = {
  arm: armMatches,
  clickResult: clickResultMatches,
  goBack: goBackMatches,
  clickAnother: clickAnotherMatches,
  celebrateBranch: celebrateBranchMatches,
  returnToAbandoned: returnToAbandonedMatches,
};

/**
 * On-enter hook for a step. Returns the spotlight to apply (or null).
 * Called by the observer after it advances to this step.
 */
export function onEnterSpotlight(
  stepId: TourStepId,
  snapshot: TourStateSnapshot,
): { nodeId: NodeId | null; kind: "pulse" | "target" | null } {
  switch (stepId) {
    case "arm":
    case "clickResult":
      return { nodeId: null, kind: null };
    case "goBack":
    case "clickAnother":
      // Pulse the branch parent while the user acts on it — pressing
      // Back, then picking another link.
      return snapshot.branchParentId
        ? { nodeId: snapshot.branchParentId, kind: "pulse" }
        : { nodeId: null, kind: null };
    case "celebrateBranch":
      // Keep the pulse on the branch parent — the fork is now
      // visible and the user reads the success state.
      return snapshot.branchParentId
        ? { nodeId: snapshot.branchParentId, kind: "pulse" }
        : { nodeId: null, kind: null };
    case "returnToAbandoned": {
      return snapshot.firstResultChildId
        ? { nodeId: snapshot.firstResultChildId, kind: "target" }
        : { nodeId: null, kind: null };
    }
  }
}

/**
 * Map step index → id. Keeps the observer decoupled from array
 * indexing.
 */
export function stepAt(index: number): TourStepId | null {
  return TOUR_STEPS[index] ?? null;
}
