import { useStore } from '../../state/store.js';
import { shallow } from 'zustand/shallow';
import GraphCanvas from './GraphCanvas.js';
import React from 'react';

export default function GraphArea() {
  const graphState = useStore(
    (state) => ({
      tree: state.tree,
      treeUpdate: state.treeUpdate,
      currentNodeId: state.currentNodeId,
      openNodeIds: state.openNodeIds,
      collapsedNodeIds: state.graph.collapsedNodeIds,
      collapseVersion: state.graph.collapseVersion,
      collapseAction: state.graph.collapseAction,
      nodeTabCounts: state.nodeTabCounts,
      tabStates: state.tabStates,
      search: {
        results: state.search.results,
        index: state.search.index,
        navStep: state.search.navStep,
        active: state.search.active,
      },
      settings: state.settings,
      showConnections: state.settings?.showConnections ?? true,
      detailMode: state.overlayEffects.lodCount > 0 ? ('dot' as const) : ('full' as const),
      graphView: state.graph.view,
      tool: state.graph.tool,
      selectedNodeIds: state.graph.selectedNodeIds,
      hoverNodeId: state.graph.hoverNodeId,
      resetVersion: state.graph.resetVersion,
      viewIntent: state.graph.viewIntent,
      tagDefs: state.tagDefs,
      editorActive: state.editorMode.active,
    }),
    shallow,
  );

  const graphActions = useStore(
    (state) => ({
      onGraphToolChange: state.setGraphTool,
      onSelectedNodeIdsChange: state.setSelectedNodeIds,
      onClearSelection: state.clearSelection,
      onGraphViewChange: state.setGraphView,
      onSetHoverNodeId: state.setHoverNodeId,
      onOpenContextMenu: state.openContextMenu,
      onClearViewIntent: state.clearViewIntent,
      onExpandNodes: state.expandNodes,
    }),
    shallow,
  );

  return <GraphCanvas {...graphState} {...graphActions} />;
}
