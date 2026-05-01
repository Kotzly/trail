import { useMemo } from "react";
import type { NodeId } from "@shared/types/ids.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { Settings } from "@shared/types/settings.js";
import type { LayoutResult } from "../types.js";
import { applyNodeMetadata, computeGeometry, type LayoutMetadata } from "../layout.js";
import { applyEdgeHighlight, computeActivePathIds } from "../transforms.js";
import { compileCollapselist } from "@shared/lib/url-blocklist.js";
import { computeChainFoldInfo, EMPTY_FOLD_INFO } from "../fold-chains.js";

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
  const nodes = useMemo(
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

  // Edges: base edges with active-path styling overlaid. New array only
  // when the active path changes — unchanged edges keep reference
  // identity, so ReactFlow's internal diff is cheap.
  const edges = useMemo(
    () => applyEdgeHighlight(geometry.baseEdges, activePathIds),
    [geometry.baseEdges, activePathIds],
  );

  return { nodes, edges };
}
