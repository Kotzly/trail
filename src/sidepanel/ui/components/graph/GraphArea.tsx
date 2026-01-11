import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { NodeId } from '../../../../shared/types/ids.js';
import type { NavigationNode } from '../../../../shared/types/node.js';
import { navigateTo } from '../../../api/tree.js';
import { getLayoutConfig, NODE_HEIGHT, NODE_WIDTH, PADDING, setLayoutConfig, VERTICAL_GAP, HORIZONTAL_GAP } from '../../graph/layout/config.js';
import { calculateLayout, getCanvasBounds } from '../../graph/layout/calculator.js';
import type { CanvasBounds, NodePosition } from '../../graph/types.js';
import GraphNode from './GraphNode.js';
import GraphZoomControls from './GraphZoomControls.js';
import { useStore } from '../../state/store.js';
import React from 'react';


type SelectionBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Connection = {
  id: string;
  d: string;
  branchClass: string;
  onPath: boolean;
};

function getPathToNode(root: NavigationNode, targetId: NodeId): Set<NodeId> {
  const path = new Set<NodeId>();
  const findPath = (node: NavigationNode | null): boolean => {
    if (!node) return false;
    path.add(node.id);
    if (node.id === targetId) return true;
    for (const child of node.getChildren()) {
      if (findPath(child)) return true;
    }
    path.delete(node.id);
    return false;
  };
  findPath(root);
  return path;
}

function buildConnections(
  root: NavigationNode | null,
  positions: Map<number, NodePosition>,
  pathNodeIds: Set<NodeId> | null,
): Connection[] {
  if (!root) return [];
  const { nodeWidth, nodeHeight } = getLayoutConfig();
  const list: Connection[] = [];
  const traverse = (node: NavigationNode | null) => {
    if (!node) return;
    const parentPos = positions.get(node.id);
    if (!parentPos) return;
    node.getChildren().forEach((child, idx) => {
      const childPos = positions.get(child.id);
      if (!childPos) return;
      const startX = parentPos.x + nodeWidth / 2;
      const startY = parentPos.y + nodeHeight;
      const endX = childPos.x + nodeWidth / 2;
      const endY = childPos.y;
      const midY = (startY + endY) / 2;
      const d = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
      const onPath =
        pathNodeIds ? pathNodeIds.has(node.id) && pathNodeIds.has(child.id) : false;
      list.push({
        id: `${node.id}-${child.id}`,
        d,
        branchClass: `branch-${(idx % 5) + 1}`,
        onPath,
      });
      traverse(child);
    });
  };
  traverse(root);
  return list;
}

export default function GraphArea() {
  const tree = useStore((state) => state.tree);
  const currentNodeId = useStore((state) => state.currentNodeId);
  const openNodeIds = useStore((state) => state.openNodeIds);
  const nodeTabCounts = useStore((state) => state.nodeTabCounts);
  const tabStates = useStore((state) => state.tabStates);
  const search = useStore((state) => state.search);
  const selectedNodeIds = useStore((state) => state.graph.selectedNodeIds);
  const tool = useStore((state) => state.graph.tool);
  const graphView = useStore((state) => state.graph.view);
  const focusNodeId = useStore((state) => state.focusNodeId);

  const setGraphTool = useStore((state) => state.setGraphTool);
  const setSelectedNodeIds = useStore((state) => state.setSelectedNodeIds);
  const toggleSelectedNode = useStore((state) => state.toggleSelectedNode);
  const clearSelection = useStore((state) => state.clearSelection);
  const setGraphView = useStore((state) => state.setGraphView);
  const openContextMenu = useStore((state) => state.openContextMenu);
  const setFocusNodeId = useStore((state) => state.setFocusNodeId);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef(graphView);
  const didInitView = useRef(false);
  const prevMetaRef = useRef<{ nodeCount: number; currentNodeId: NodeId | null }>({
    nodeCount: 0,
    currentNodeId: null,
  });

  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [previewSelection, setPreviewSelection] = useState<Set<NodeId>>(new Set());
  const previewSelectionRef = useRef<Set<NodeId>>(new Set());
  const isPanningRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const isSelectingRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const baseSelectionRef = useRef<Set<NodeId>>(new Set());

  useEffect(() => {
    setLayoutConfig({
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
      verticalGap: VERTICAL_GAP,
      horizontalGap: HORIZONTAL_GAP,
    });
  }, []);

  useEffect(() => {
    viewRef.current = graphView;
  }, [graphView]);

  const root = tree?.getRoot() ?? null;
  const { nodeWidth, nodeHeight } = getLayoutConfig();

  const layout = useMemo(() => {
    if (!root) return null;
    return calculateLayout(root);
  }, [root]);

  const positions = layout?.positions ?? new Map<number, NodePosition>();
  const bounds: CanvasBounds = useMemo(() => {
    if (!layout) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
    }
    return getCanvasBounds(layout.positions);
  }, [layout]);

  const nodes = useMemo(() => Array.from(positions.values()), [positions]);
  const searchSet = useMemo(() => new Set(search.results), [search.results]);
  const focusedSearchId = search.results[search.index];
  const pathNodeIds = useMemo(() => {
    if (!root || currentNodeId === null) return null;
    return getPathToNode(root, currentNodeId);
  }, [currentNodeId, root]);

  const connections = useMemo(() => buildConnections(root, positions, pathNodeIds), [positions, pathNodeIds, root]);

  const fitToView = (animate = false) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const treeWidth = bounds.maxX - bounds.minX + PADDING * 2;
    const treeHeight = bounds.maxY - bounds.minY + PADDING * 2;
    const scaleX = (rect.width * 0.9) / treeWidth;
    const scaleY = (rect.height * 0.9) / treeHeight;
    const scale = Math.min(scaleX, scaleY, 2);
    const translateX = (rect.width - treeWidth * scale) / 2 - (bounds.minX - PADDING) * scale;
    const translateY = (rect.height - treeHeight * scale) / 2 - (bounds.minY - PADDING) * scale;
    setGraphView({ translateX, translateY, scale });
    if (animate && canvasRef.current) {
      canvasRef.current.style.transition = 'transform 0.3s ease-out';
      setTimeout(() => {
        if (canvasRef.current) canvasRef.current.style.transition = 'none';
      }, 300);
    }
  };

  const centerOnNode = (nodeId: NodeId, animate = true) => {
    const wrapper = wrapperRef.current;
    const nodeEl = wrapper?.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
    if (!wrapper || !nodeEl) return;
    const rect = wrapper.getBoundingClientRect();
    const nodeRect = nodeEl.getBoundingClientRect();
    const { translateX, translateY, scale } = viewRef.current;
    const nodeCenterX = (nodeRect.left + nodeRect.width / 2 - rect.left - translateX) / scale;
    const nodeCenterY = (nodeRect.top + nodeRect.height / 2 - rect.top - translateY) / scale;
    const nextTranslateX = rect.width / 2 - nodeCenterX * scale;
    const nextTranslateY = rect.height / 2 - nodeCenterY * scale;
    setGraphView({ translateX: nextTranslateX, translateY: nextTranslateY });
    if (animate && canvasRef.current) {
      canvasRef.current.style.transition = 'transform 0.3s ease-out';
      setTimeout(() => {
        if (canvasRef.current) canvasRef.current.style.transition = 'none';
      }, 300);
    }
  };

  useEffect(() => {
    if (!root || didInitView.current) return;
    didInitView.current = true;
    fitToView(false);
  }, [bounds.height, bounds.width, root]);

  useEffect(() => {
    if (focusNodeId === null) return;
    centerOnNode(focusNodeId, true);
    setFocusNodeId(null);
  }, [focusNodeId, setFocusNodeId]);

  useEffect(() => {
    if (!root || currentNodeId === null) return;
    const prev = prevMetaRef.current;
    const nodeCount = tree?.size() ?? 0;
    const shouldCenter =
      (prev.nodeCount !== 0 && nodeCount > prev.nodeCount) ||
      (prev.currentNodeId !== null && prev.currentNodeId !== currentNodeId);
    if (shouldCenter) {
      centerOnNode(currentNodeId, true);
    }
    prevMetaRef.current = { nodeCount, currentNodeId };
  }, [currentNodeId, root, tree]);

  const zoomAt = (pointerX: number, pointerY: number, scaleFactor: number) => {
    const { translateX, translateY, scale } = viewRef.current;
    const nextScale = Math.min(3, Math.max(0.15, scale * scaleFactor));
    if (nextScale === scale) return;
    const canvasX = (pointerX - translateX) / scale;
    const canvasY = (pointerY - translateY) / scale;
    const nextTranslateX = pointerX - canvasX * nextScale;
    const nextTranslateY = pointerY - canvasY * nextScale;
    setGraphView({ translateX: nextTranslateX, translateY: nextTranslateY, scale: nextScale });
  };

  const zoom = (direction: 'in' | 'out' | 'reset') => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (direction === 'reset') {
      fitToView(true);
      return;
    }
    const rect = wrapper.getBoundingClientRect();
    const pointerX = rect.width / 2;
    const pointerY = rect.height / 2;
    const scaleFactor = direction === 'in' ? 1.25 : 0.8;
    zoomAt(pointerX, pointerY, scaleFactor);
  };

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('.graph-node')) return;
    if (!wrapperRef.current) return;

    if (tool === 'hand') {
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = {
        x: event.clientX - viewRef.current.translateX,
        y: event.clientY - viewRef.current.translateY,
      };
    } else if (tool === 'select') {
      isSelectingRef.current = true;
      const rect = wrapperRef.current.getBoundingClientRect();
      const startX = event.clientX - rect.left;
      const startY = event.clientY - rect.top;
      selectionStartRef.current = { x: startX, y: startY };
      baseSelectionRef.current = event.shiftKey ? new Set(selectedNodeIds) : new Set();
      setSelectionBox({ left: startX, top: startY, width: 0, height: 0 });
      const base = new Set(baseSelectionRef.current);
      previewSelectionRef.current = base;
      setPreviewSelection(base);
    }
  };

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!wrapperRef.current) return;
    if (isPanningRef.current) {
      const nextTranslateX = event.clientX - panStartRef.current.x;
      const nextTranslateY = event.clientY - panStartRef.current.y;
      setGraphView({ translateX: nextTranslateX, translateY: nextTranslateY });
      return;
    }
    if (isSelectingRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const left = Math.min(selectionStartRef.current.x, x);
      const top = Math.min(selectionStartRef.current.y, y);
      const width = Math.abs(x - selectionStartRef.current.x);
      const height = Math.abs(y - selectionStartRef.current.y);
      setSelectionBox({ left, top, width, height });

      const { translateX, translateY, scale } = viewRef.current;
      const graphLeft = (left - translateX) / scale;
      const graphTop = (top - translateY) / scale;
      const graphRight = (left + width - translateX) / scale;
      const graphBottom = (top + height - translateY) / scale;
      const { nodeWidth, nodeHeight } = getLayoutConfig();
      const intersects = new Set<NodeId>();
      nodes.forEach((pos) => {
        const nodeLeft = pos.x;
        const nodeRight = pos.x + nodeWidth;
        const nodeTop = pos.y;
        const nodeBottom = pos.y + nodeHeight;
        const hit = !(nodeRight < graphLeft || nodeLeft > graphRight || nodeBottom < graphTop || nodeTop > graphBottom);
        if (hit) intersects.add(pos.node.id);
      });
      const preview = new Set<NodeId>(baseSelectionRef.current);
      intersects.forEach((id) => preview.add(id));
      previewSelectionRef.current = preview;
      setPreviewSelection(preview);
    }
  };

  const finalizeSelection = (event: ReactMouseEvent<HTMLDivElement> | null) => {
    if (!isSelectingRef.current) return;
    isSelectingRef.current = false;
    const finalSelection = new Set(previewSelectionRef.current);
    if (!event?.shiftKey && baseSelectionRef.current.size === 0) {
      setSelectedNodeIds(finalSelection);
    } else {
      setSelectedNodeIds(finalSelection);
    }
    setSelectionBox(null);
    previewSelectionRef.current = new Set();
    setPreviewSelection(new Set());
  };

  const handleMouseUp = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
      return;
    }
    finalizeSelection(event);
  };

  const handleMouseLeave = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
    }
    if (isSelectingRef.current) {
      finalizeSelection(null);
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const isTrackpadPinch = event.ctrlKey;
    const hasModifier = event.altKey || event.metaKey;
    const isMouseWheel = event.deltaMode === 1 || event.deltaMode === 2;
    const shouldZoom = isTrackpadPinch || hasModifier || isMouseWheel;
    if (shouldZoom) {
      const scaleFactor = isMouseWheel ? (event.deltaY > 0 ? 0.85 : 1.18) : 1 - event.deltaY * 0.005;
      zoomAt(pointerX, pointerY, scaleFactor);
    } else {
      setGraphView({
        translateX: viewRef.current.translateX - event.deltaX,
        translateY: viewRef.current.translateY - event.deltaY,
      });
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    if (key === '+' || key === '=') {
      event.preventDefault();
      zoom('in');
    } else if (key === '-' || key === '_') {
      event.preventDefault();
      zoom('out');
    } else if (key === '0') {
      event.preventDefault();
      zoom('reset');
    } else if (key === 'h' || key === 'H') {
      event.preventDefault();
      setGraphTool('hand');
      clearSelection();
      setPreviewSelection(new Set());
      setSelectionBox(null);
    } else if (key === 'v' || key === 'V') {
      event.preventDefault();
      setGraphTool('select');
      clearSelection();
      setPreviewSelection(new Set());
      setSelectionBox(null);
    } else if (key === 'Escape') {
      event.preventDefault();
      clearSelection();
      setPreviewSelection(new Set());
      setSelectionBox(null);
    }
  };

  const handleNodeClick = async (
    node: NavigationNode,
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    event.stopPropagation();
    if (event.shiftKey) {
      toggleSelectedNode(node.id);
      return;
    }
    if (tool === 'select') {
      setSelectedNodeIds(new Set([node.id]));
      return;
    }
    clearSelection();
    try {
      await navigateTo(node);
    } catch (error) {
      console.error('Failed to navigate:', error);
    }
    setFocusNodeId(node.id);
  };

  const handleNodeContextMenu = (
    node: NavigationNode,
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    openContextMenu({
      type: 'node',
      nodeId: node.id,
      position: { x: event.clientX, y: event.clientY },
    });
  };

  const handleWrapperContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('.graph-node')) return;
    if (selectedNodeIds.size === 0) return;
    event.preventDefault();
    openContextMenu({
      type: 'bulk',
      nodeIds: Array.from(selectedNodeIds),
      position: { x: event.clientX, y: event.clientY },
    });
  };

  const handleBackgroundClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('.graph-node')) return;
    clearSelection();
  };

  if (!root) {
    return (
      <div className="stack-container" id="stackContainer">
        <div className="empty-state" id="emptyState">
          <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <p>no history yet</p>
          <span>start browsing to see your navigation graph</span>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-container" id="stackContainer">
      <div
        className="graph-wrapper"
        ref={wrapperRef}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onContextMenu={handleWrapperContextMenu}
        onClick={handleBackgroundClick}
        style={{ cursor: tool === 'hand' ? (isPanning ? 'grabbing' : 'grab') : 'crosshair' }}
      >
        <div
          className="graph-canvas"
          ref={canvasRef}
          style={{
            width: `${bounds.width}px`,
            height: `${bounds.height}px`,
            transform: `translate(${graphView.translateX}px, ${graphView.translateY}px) scale(${graphView.scale})`,
          }}
        >
          <svg className="graph-connections" width={bounds.width} height={bounds.height}>
            {connections.map((connection) => (
              <path
                key={connection.id}
                d={connection.d}
                className={`graph-connection ${connection.branchClass} ${connection.onPath ? 'on-path' : ''}`}
              />
            ))}
          </svg>
          <div className="graph-nodes">
            {nodes.map((pos) => (
              <GraphNode
                key={pos.node.id}
                node={pos.node}
                position={pos}
                nodeWidth={nodeWidth}
                nodeHeight={nodeHeight}
                currentId={currentNodeId}
                openNodeIds={openNodeIds}
                nodeTabCounts={nodeTabCounts}
                tabState={tabStates[pos.node.id]}
                isSelected={selectedNodeIds.has(pos.node.id)}
                isPreview={previewSelection.has(pos.node.id)}
                isSearchMatch={searchSet.has(pos.node.id)}
                isSearchFocused={focusedSearchId === pos.node.id}
                isSearchDimmed={search.query.length > 0 && !searchSet.has(pos.node.id)}
                onClick={(event) => void handleNodeClick(pos.node, event)}
                onContextMenu={(event) => handleNodeContextMenu(pos.node, event)}
              />
            ))}
          </div>
        </div>
        {selectionBox && (
          <div
            className="graph-selection-box"
            style={{
              left: `${selectionBox.left}px`,
              top: `${selectionBox.top}px`,
              width: `${selectionBox.width}px`,
              height: `${selectionBox.height}px`,
            }}
          />
        )}
        <GraphZoomControls
          tool={tool}
          onToolChange={(nextTool) => {
            setGraphTool(nextTool);
            clearSelection();
            setPreviewSelection(new Set());
            setSelectionBox(null);
          }}
          onZoom={zoom}
        />
      </div>
    </div>
  );
}
