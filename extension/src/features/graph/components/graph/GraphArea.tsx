import { useStore } from "@apps/sidepanel/ui/state/store.js";
import { useShallow } from "zustand/react/shallow";
import type { GraphRenderMetrics } from "../../graph/render/GraphPixiRenderer.js";
import {
  createQualityPolicyState,
  qualityPolicyFromState,
  updateQualityPolicy,
} from "../../graph/render/quality-policy.js";
import React, { Suspense, useState, useCallback } from "react";
import type { NodeId } from "@shared/types/ids.js";

const GraphCanvas = React.lazy(() => import("./GraphCanvas.js"));

function GraphSkeleton() {
  return <div className="skeleton-block skeleton-graph-fallback" />;
}

const NODE_COUNT_LOW_THRESHOLD = 500;
const NODE_COUNT_DOT_THRESHOLD = 2000;

// Prefetch: kick off the dynamic import immediately at module load time.
// React.lazy's internal import is deferred until first render inside Suspense.
// By calling import() here, the chunk fetch starts as soon as GraphArea.tsx is parsed,
// which is at sidepanel boot (it's a static import in App.tsx).
// The browser deduplicates the import() call -- React.lazy will resolve from cache.
const _prefetchGraphCanvas = import("./GraphCanvas.js");
void _prefetchGraphCanvas; // suppress unused-variable lint

type GraphAreaProps = {
  /** When set, called instead of the default navigateTo on node click. */
  onNodeActivate?: (nodeId: NodeId, url: string) => void;
  showControls?: boolean;
  /** Limit initial zoom to ~25×36 nodes (Spotlight mode). */
  compactInitialView?: boolean;
  /** When set, center the initial compact view on this node instead of recency centroid. */
  initialCenterNodeId?: NodeId | undefined;
};

export default function GraphArea({
  onNodeActivate,
  showControls = true,
  compactInitialView = false,
  initialCenterNodeId,
}: GraphAreaProps = {}) {
  const [qualityPolicyState, setQualityPolicyState] = React.useState(() =>
    createQualityPolicyState(Date.now()),
  );

  const [gestureActive, setGestureActive] = useState(false);
  const handleGestureActiveChange = useCallback((active: boolean) => {
    setGestureActive(active);
  }, []);

  const graphState = useStore(
    useShallow((state) => ({
      tree: state.tree,
      treeUpdate: state.treeUpdate,
      currentNodeId: state.currentNodeId,
      openNodeIds: state.openNodeIds,
      collapsedNodeIds: state.graph.collapsedNodeIds,
      collapseVersion: state.graph.collapseVersion,
      collapseAction: state.graph.collapseAction,
      nodeTabCounts: state.nodeTabCounts,
      nodeRecency: state.nodeRecency,
      tabStates: state.tabStates,
      settings: state.settings,
      showConnections: state.settings?.showConnections ?? true,
      overlayLodCount: state.overlayEffects.lodCount,
      adaptivePerformance: state.flags?.adaptivePerformance ?? false,
      graphView: state.graph.view,
      tool: state.graph.tool,
      selectedNodeIds: state.graph.selectedNodeIds,
      hoverNodeId: state.graph.hoverNodeId,
      resetVersion: state.graph.resetVersion,
      viewIntent: state.graph.viewIntent,
      tagDefs: state.tagDefs,
      editorActive: state.editorMode.active,
      pickTarget: state.pickTarget,
      fullViewEnabled: state.flags?.fullView ?? false,
      recencyOrderingV2Enabled: state.flags?.recencyOrderingV2 ?? false,
    })),
  );

  const searchState = useStore(
    useShallow((state) => ({
      results: state.search.results,
      index: state.search.index,
      navStep: state.search.navStep,
      active: state.search.active,
    })),
  );

  const handleRenderMetrics = React.useCallback(
    (metrics: GraphRenderMetrics) => {
      if (!graphState.adaptivePerformance) {
        setQualityPolicyState((prev) =>
          prev.level === "full" ? prev : createQualityPolicyState(Date.now()),
        );
        return;
      }

      const frameMs = metrics.updateVisibleMs + metrics.renderMs;
      setQualityPolicyState((prev) => {
        const { state: next, scoreMs } = updateQualityPolicy(
          prev,
          {
            ...metrics,
            frameMs,
          },
          Date.now(),
        );

        if (
          typeof window !== "undefined" &&
          (window as { __TRAIL_GRAPH_POLICY_DEBUG?: boolean }).__TRAIL_GRAPH_POLICY_DEBUG
        ) {
          console.debug("[graph-policy]", {
            scoreMs: Number(scoreMs.toFixed(2)),
            frameMs: Number(frameMs.toFixed(2)),
            level: next.level,
            visibleNodes: metrics.visibleNodes,
            visibleConnections: metrics.visibleConnections,
            restoreBacklog: metrics.restoreBacklog,
            restoreBatchMs: Number(metrics.restoreBatchMs.toFixed(2)),
            restoredNodeCount: metrics.restoredNodeCount,
          });
        }

        return next;
      });
    },
    [graphState.adaptivePerformance],
  );

  const adaptiveQuality = React.useMemo(
    () => qualityPolicyFromState(qualityPolicyState),
    [qualityPolicyState],
  );

  // Node-count quality floor: large trees start at reduced quality
  const nodeCount = graphState.tree?.size() ?? 0;
  const nodeCountFloor: "full" | "low" | "dot" =
    nodeCount >= NODE_COUNT_DOT_THRESHOLD
      ? "dot"
      : nodeCount >= NODE_COUNT_LOW_THRESHOLD
        ? "low"
        : "full";

  const DETAIL_RANK = { dot: 0, low: 1, full: 2 } as const;
  const worstDetail = (a: "full" | "low" | "dot", b: "full" | "low" | "dot") =>
    DETAIL_RANK[a] <= DETAIL_RANK[b] ? a : b;

  const baseDetailMode =
    graphState.overlayLodCount > 0
      ? ("dot" as const)
      : gestureActive
        ? ("low" as const)
        : graphState.adaptivePerformance
          ? adaptiveQuality.detailMode
          : ("full" as const);

  const detailMode = worstDetail(baseDetailMode, nodeCountFloor);

  const connectionQuality =
    graphState.overlayLodCount > 0
      ? ("thin" as const)
      : graphState.adaptivePerformance
        ? adaptiveQuality.connectionQuality
        : ("full" as const);

  const graphActions = useStore(
    useShallow((state) => ({
      onGraphToolChange: state.setGraphTool,
      onSelectedNodeIdsChange: state.setSelectedNodeIds,
      onClearSelection: state.clearSelection,
      onGraphViewChange: state.setGraphView,
      onSetHoverNodeId: state.setHoverNodeId,
      onOpenContextMenu: state.openContextMenu,
      onClearViewIntent: state.clearViewIntent,
      onExpandNodes: state.expandNodes,
      onPickTargetComplete: state.clearPickTarget,
    })),
  );

  return (
    <Suspense fallback={<GraphSkeleton />}>
      <GraphCanvas
        {...graphState}
        {...graphActions}
        search={searchState}
        detailMode={detailMode}
        connectionQuality={connectionQuality}
        onRenderMetrics={handleRenderMetrics}
        onGestureActiveChange={handleGestureActiveChange}
        {...(onNodeActivate ? { onNodeActivate } : {})}
        showControls={showControls}
        compactInitialView={compactInitialView}
        initialCenterNodeId={initialCenterNodeId}
      />
    </Suspense>
  );
}
