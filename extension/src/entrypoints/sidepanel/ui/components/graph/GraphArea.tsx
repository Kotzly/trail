import { useStore } from '../../state/store.js';
import { useShallow } from 'zustand/react/shallow';
import type { GraphRenderMetrics } from '../../graph/render/GraphPixiRenderer.js';
import {
  createQualityPolicyState,
  qualityPolicyFromState,
  updateQualityPolicy,
} from '../../graph/render/quality-policy.js';
import React, { Suspense } from 'react';

const GraphCanvas = React.lazy(() => import('./GraphCanvas.js'));

export default function GraphArea() {
  const [qualityPolicyState, setQualityPolicyState] = React.useState(() =>
    createQualityPolicyState(Date.now()),
  );

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
      adaptivePerformance: state.settings?.adaptivePerformance ?? true,
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
          prev.level === 'full' ? prev : createQualityPolicyState(Date.now()),
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
          typeof window !== 'undefined' &&
          (window as { __TRAIL_GRAPH_POLICY_DEBUG?: boolean }).__TRAIL_GRAPH_POLICY_DEBUG
        ) {
          console.debug('[graph-policy]', {
            scoreMs: Number(scoreMs.toFixed(2)),
            frameMs: Number(frameMs.toFixed(2)),
            level: next.level,
            visibleNodes: metrics.visibleNodes,
            visibleConnections: metrics.visibleConnections,
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

  const detailMode =
    graphState.overlayLodCount > 0
      ? ('dot' as const)
      : graphState.adaptivePerformance
        ? adaptiveQuality.detailMode
        : ('full' as const);

  const connectionQuality =
    graphState.overlayLodCount > 0
      ? ('thin' as const)
      : graphState.adaptivePerformance
        ? adaptiveQuality.connectionQuality
        : ('full' as const);

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
    <Suspense fallback={null}>
      <GraphCanvas
        {...graphState}
        {...graphActions}
        search={searchState}
        detailMode={detailMode}
        connectionQuality={connectionQuality}
        onRenderMetrics={handleRenderMetrics}
      />
    </Suspense>
  );
}
