import type { NodeId } from '../../../../shared/types/ids';
import type { TreeData, RenderGraphOptions } from '../types';
import { createGraphCanvas } from './canvas';
import { createGraphNode, drawConnections, getPathToNode } from './node';
import { calculateLayout, getCanvasBounds } from '../layout/calculator';
import { PADDING, setLayoutConfig, NODE_WIDTH, NODE_HEIGHT, VERTICAL_GAP, HORIZONTAL_GAP } from '../layout/config';
import { setupPanZoom } from '../interaction/pan-zoom';
import { GraphState } from '../state/graph-state';
import { NavigationNode } from '../../../../shared/types/node';

/**
 * Render graph view.
 * Single tree layout.
 */
export function renderGraphView(treeData: TreeData, container: HTMLElement, options: RenderGraphOptions): NodeId | null {
  const {
    openNodeIds = null,
    tabStates = {},
    nodeTabCounts = {}
  } = options;
  
  
  // Store tab states and tab counts for node creation
  GraphState.setCurrentTabStates(tabStates);
  GraphState.setCurrentNodeTabCounts(nodeTabCounts);
  

    setLayoutConfig({
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
      verticalGap: VERTICAL_GAP,
      horizontalGap: HORIZONTAL_GAP,
    });

    const root: NavigationNode | null = treeData.root ?? null;
    const currentId: NodeId | null = treeData.currentNodeId ?? null;

    // Clear container
    container.innerHTML = '';
  
  // Create canvas (even if empty)
  const { wrapper, canvas, connectionsLayer, nodesLayer, zoomControls } = createGraphCanvas();
  container.appendChild(wrapper);
  
  if (!root) {
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

  // Calculate layout for single tree
  const { positions, width } = calculateLayout(root); // todo: check if we need to use this width
  const bounds = getCanvasBounds(positions);

  // Set SVG size
  connectionsLayer.setAttribute('width', String(bounds.width));

  connectionsLayer.setAttribute('height', String(bounds.height));
  connectionsLayer.style.width = `${bounds.width}px`;
  connectionsLayer.style.height = `${bounds.height}px`;
  
  // Get path to current node for highlighting
  const pathNodeIds = currentId ? getPathToNode(root, currentId) : null;
  
  // Draw connections
  drawConnections(root, positions, connectionsLayer, pathNodeIds);
  
  // Create nodes
  positions.forEach((pos) => {
    const nodeEl = createGraphNode(
      pos.node,
      pos,
      currentId,
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
