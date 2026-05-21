import { useEffect, useMemo, useRef } from "react";
import type { NodeId } from "@shared/types/ids.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { Settings } from "@shared/types/settings.js";
import type { LayoutResult, TrailNode } from "../types.js";
import { applyNodeMetadata, computeGeometry, type LayoutMetadata } from "../layout.js";
import { applyEdgeHighlight, computeActivePathIds } from "../transforms.js";
import { compileCollapselist } from "@shared/lib/url-blocklist.js";
import { computeChainFoldInfo, EMPTY_FOLD_INFO } from "../fold-chains.js";
import { trailNodeEqual } from "../node-equality.js";

type UseGraphLayoutInput = {
  tree: NavigationTreeJSON | null;
  settings: Settings;
  collapsedNodeIds: Set<NodeId>;
  /** Tip IDs the user has manually unfolded — exempted from chain folding. */
  unfoldedChainIds: Set<NodeId>;
  metadata: LayoutMetadata;
  precomputedPositions?: Record<string, { x: number; y: number }> | null | undefined;
};

/**
 * Two-stage layout hook:
 *
 *   1. Geometry (d3 layout, edge topology, handle assignment) is
 *      memoized against tree + settings + collapsed state. Tab
 *      activation and tab-count churn don't invalidate this — big win
 *      because d3-hierarchy + two tree walks run on every
 *      `useMemo` recomputation.
 *
 *   2. Node metadata (current / open / tab counts / active-path) is
 *      applied on top. Produces a fresh node list synchronously; the
 *      `TrailNode` memo comparator catches unchanged fields so
 *      ReactFlow only repaints actually-changed nodes.
 */
export function useGraphLayout(input: UseGraphLayoutInput): LayoutResult {
  const { tree, settings, collapsedNodeIds, unfoldedChainIds, metadata, precomputedPositions } =
    input;

  // Chain-fold info: drives hidden-node skip in both transforms and d3
  // positioning. Memoized on tree shape + patterns + manual-unfold set
  // so normal tab-focus churn doesn't retrigger the walk.
  const collapselist = settings.privacy.collapselist;
  const foldInfo = useMemo(() => {
    if (collapselist.length === 0) return EMPTY_FOLD_INFO;
    const matches = compileCollapselist(collapselist);
    return computeChainFoldInfo(tree, matches, unfoldedChainIds);
  }, [tree, collapselist, unfoldedChainIds]);

  // Geometry: positions + base edges + handles. Expensive; cache it.
  const geometry = useMemo(
    () => computeGeometry(tree, settings, collapsedNodeIds, precomputedPositions, foldInfo),
    [tree, settings, collapsedNodeIds, precomputedPositions, foldInfo],
  );

  // Active-path only depends on tree + currentNodeId. Extract so the
  // hierarchy walk doesn't run on open/tab-count changes.
  const { currentNodeId } = metadata;
  const activePathIds = useMemo(
    () => computeActivePathIds(tree, currentNodeId),
    [tree, currentNodeId],
  );

  // Nodes: synchronous application of metadata onto cached geometry.
  const rawNodes = useMemo(
    () =>
      applyNodeMetadata(
        tree,
        settings,
        collapsedNodeIds,
        metadata,
        geometry,
        activePathIds,
        foldInfo,
      ),
    [tree, settings, collapsedNodeIds, metadata, geometry, activePathIds, foldInfo],
  );

  // Per-node identity stabilization. `applyNodeMetadata` allocates a
  // fresh TrailNode + data object for every node on every metadata
  // change — on a 5k-tree that's 5k allocations per tab-focus event.
  // For the vast majority of those nodes, every field is structurally
  // identical to the previous render. Comparing the new node against
  // the cached one and reusing the cached ref when they match keeps
  // xyflow's internal diff on the reference-equality fast path and
  // lets downstream memos short-circuit by identity.
  //
  // Memo-as-cache pattern: the ref always holds the LAST-COMMITTED
  // render's nodes (written from useEffect below). Reading it inside
  // useMemo is a deterministic function of (rawNodes, last commit) —
  // a discarded concurrent render sees the same pre-commit cache as
  // the next attempt, so the cache never observes a tear.
  const stableNodesCacheRef = useRef<Map<string, TrailNode>>(new Map());
  /* eslint-disable react-hooks/refs -- memo-as-cache; ref always reflects
     the last-committed render's nodes (written in useEffect below). A
     discarded concurrent render reads the same pre-commit cache as the
     next attempt, so the cache never observes a tear. */
  const nodes = useMemo(() => {
    const cache = stableNodesCacheRef.current;
    if (cache.size === 0) return rawNodes;
    return rawNodes.map((node) => {
      const cached = cache.get(node.id);
      return cached !== undefined && trailNodeEqual(cached, node) ? cached : node;
    });
  }, [rawNodes]);
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    const next = new Map<string, TrailNode>();
    for (const n of nodes) next.set(n.id, n);
    stableNodesCacheRef.current = next;
  }, [nodes]);

  // Position lookup, built from the stable nodes so it shares their
  // reference identity story — same memo, no extra allocations beyond
  // the Map itself.
  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const n of nodes) map.set(n.id, n.position);
    return map;
  }, [nodes]);

  // Edges: base edges with active-path styling overlaid. New array only
  // when the active path changes — unchanged edges keep reference
  // identity, so ReactFlow's internal diff is cheap.
  const edges = useMemo(
    () => applyEdgeHighlight(geometry.baseEdges, activePathIds),
    [geometry.baseEdges, activePathIds],
  );

  return { nodes, edges, positions };
}
