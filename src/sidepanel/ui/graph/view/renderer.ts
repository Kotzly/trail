import type { NodeId } from '../../../../shared/types/ids';
import type { TreeNode } from '../../../../background/state/tree-node';
import type { TreeData, RenderGraphOptions } from '../types';
import { createGraphCanvas } from './canvas';
import { createGraphNode, drawConnections, getPathToNodeInForest } from './node';
import { calculateForestLayout, getCanvasBounds } from '../layout/calculator';
import { PADDING, setLayoutConfig, COMPACT_NODE_WIDTH, COMPACT_NODE_HEIGHT, COMPACT_VERTICAL_GAP, COMPACT_HORIZONTAL_GAP, COMPACT_ROOT_GAP, NODE_WIDTH, NODE_HEIGHT, VERTICAL_GAP, HORIZONTAL_GAP, ROOT_GAP } from '../layout/config';
import { setupPanZoom } from '../interaction/pan-zoom';
import { GraphState } from '../state/graph-state';

/**
 * Render graph view.
 * Supports multiple roots (forest structure) - trees are arranged horizontally.
 */
export function renderGraphView(
  treeData: TreeData,
  container: HTMLElement,
  options: RenderGraphOptions
): NodeId | null {
  const {
    onNavigate,
    openNodeIds = null,
    compactGraph = false,
    tabStates = {},
    selectionMenuInstant = false,
    nodeTabCounts = {}
  } = options;
  
  // Store settings for use in other functions
  GraphState.setSelectionMenuInstantSetting(selectionMenuInstant);
  GraphState.setCurrentOnNavigate(onNavigate);
  
  // Store tab states and tab counts for node creation
  GraphState.setCurrentTabStates(tabStates);
  GraphState.setCurrentNodeTabCounts(nodeTabCounts);
  
  // Set layout config based on compact mode
  if (compactGraph) {
    setLayoutConfig({
      nodeWidth: COMPACT_NODE_WIDTH,
      nodeHeight: COMPACT_NODE_HEIGHT,
      verticalGap: COMPACT_VERTICAL_GAP,
      horizontalGap: COMPACT_HORIZONTAL_GAP,
      rootGap: COMPACT_ROOT_GAP,
      compact: true
    });
  } else {
    setLayoutConfig({
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
      verticalGap: VERTICAL_GAP,
      horizontalGap: HORIZONTAL_GAP,
      rootGap: ROOT_GAP,
      compact: false
    });
  }
  
  // Support both 'roots' array and legacy 'root' field
  const roots: TreeNode[] = treeData?.roots || (treeData?.root ? [treeData.root] : []);
  const currentId: NodeId | null = treeData?.currentNodeId ?? null;
  
  // Clear container
  container.innerHTML = '';
  
  // Create canvas (even if empty)
  const { wrapper, canvas, connectionsLayer, nodesLayer, zoomControls } = createGraphCanvas();
  container.appendChild(wrapper);
  
  if (roots.length === 0) {
    // Empty graph - just show canvas with controls, no nodes
    // Set minimal SVG size
    connectionsLayer.setAttribute('width', '100');
    connectionsLayer.setAttribute('height', '100');
    connectionsLayer.style.width = '100px';
    connectionsLayer.style.height = '100px';
    
    // Setup pan/zoom for empty canvas (with no initial translate)
    const emptyBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
    const graphAPI = setupPanZoom(wrapper, canvas, emptyBounds, { x: 0, y: 0 }, zoomControls);
    GraphState.setGraphAPI(graphAPI);
    
    return null;
  }
  
  // Calculate layout for all trees in the forest
  const positions = calculateForestLayout(roots);
  const bounds = getCanvasBounds(positions);
  
  // Set SVG size
  connectionsLayer.setAttribute('width', String(bounds.width));
  connectionsLayer.setAttribute('height', String(bounds.height));
  connectionsLayer.style.width = `${bounds.width}px`;
  connectionsLayer.style.height = `${bounds.height}px`;
  
  // Get path to current node for highlighting (search across all roots)
  const pathNodeIds = currentId ? getPathToNodeInForest(roots, currentId) : null;
  
  // Draw connections for each tree
  roots.forEach((root) => {
    drawConnections(root, positions, connectionsLayer, pathNodeIds);
  });
  
  // Create nodes
  positions.forEach((pos) => {
    const nodeEl = createGraphNode(
      pos.node,
      pos,
      currentId,
      onNavigate,
      openNodeIds,
      nodeTabCounts
    );
    nodesLayer.appendChild(nodeEl);
  });
  
  // Calculate initial translation - center tree in viewport
  const wrapperRect = wrapper.getBoundingClientRect();
  const treeWidth = bounds.maxX - bounds.minX + PADDING * 2;
  const treeHeight = bounds.maxY - bounds.minY + PADDING * 2;
  
  // Check if tree fits in viewport at 1x scale
  const fitsHorizontally = treeWidth <= wrapperRect.width * 0.9;
  const fitsVertically = treeHeight <= wrapperRect.height * 0.9;
  
  let initialTranslate = { x: 0, y: 0 };
  
  if (fitsHorizontally && fitsVertically) {
    // Tree fits - center it in viewport
    initialTranslate = {
      x: (wrapperRect.width - treeWidth) / 2 - (bounds.minX - PADDING),
      y: (wrapperRect.height - treeHeight) / 2 - (bounds.minY - PADDING)
    };
  } else {
    // Tree doesn't fit - will use fitToView in setupPanZoom
    initialTranslate = { x: 0, y: 0 };
  }
  
  // Setup pan/zoom after adding to DOM
  const graphAPI = setupPanZoom(wrapper, canvas, bounds, initialTranslate, zoomControls);
  GraphState.setGraphAPI(graphAPI);
  
  return currentId;
}
