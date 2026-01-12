import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { NodeId } from '../../../../shared/types/ids.js';
import type { NavigationNode } from '../../../../shared/types/node.js';
import { navigateTo, setNodeLayout } from '../../../api/tree.js';
import {
  getLayoutConfig,
  PADDING,
} from '../../graph/layout/config.js';
import { calculateLayout, calculateMindmapLayout, calculateRadialLayout, getCanvasBounds } from '../../graph/layout/calculator.js';
import { deriveLayoutOptions } from '../../graph/layout/options.js';
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
  layoutMode: 'tree' | 'mindmap' | 'radial',
  openNodeIds: Set<NodeId> | null,
): Connection[] {
  if (!root) return [];
  const { nodeWidth, nodeHeight } = getLayoutConfig();
  const list: Connection[] = [];
  const isClosed = (nodeId: NodeId) => openNodeIds ? !openNodeIds.has(nodeId) : false;
  const traverse = (node: NavigationNode | null) => {
    if (!node) return;
    const parentPos = positions.get(node.id);
    if (!parentPos) return;
    node.getChildren().forEach((child, idx) => {
      if (isClosed(node.id) || isClosed(child.id)) return;
      const childPos = positions.get(child.id);
      if (!childPos) return;
      let startX: number;
      let startY: number;
      let endX: number;
      let endY: number;
      if (layoutMode === 'tree') {
        startX = parentPos.x + nodeWidth / 2;
        startY = parentPos.y + nodeHeight;
        endX = childPos.x + nodeWidth / 2;
        endY = childPos.y;
      } else if (layoutMode === 'mindmap') {
        const childOnRight = childPos.x >= parentPos.x;
        startX = parentPos.x + (childOnRight ? nodeWidth : 0);
        startY = parentPos.y + nodeHeight / 2;
        endX = childPos.x + (childOnRight ? 0 : nodeWidth);
        endY = childPos.y + nodeHeight / 2;
      } else {
        startX = parentPos.x + nodeWidth / 2;
        startY = parentPos.y + nodeHeight / 2;
        endX = childPos.x + nodeWidth / 2;
        endY = childPos.y + nodeHeight / 2;
      }
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      let d: string;
      if (layoutMode === 'tree') {
        d = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
      } else if (layoutMode === 'mindmap') {
        d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
      } else {
        d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
      }
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
  const searchActive = useStore((state) => state.search.active);
  const settings = useStore((state) => state.settings);
  const selectedNodeIds = useStore((state) => state.graph.selectedNodeIds);
  const layoutVersion = useStore((state) => state.graph.layoutVersion);
  const tool = useStore((state) => state.graph.tool);
  const graphView = useStore((state) => state.graph.view);
  const setGraphTool = useStore((state) => state.setGraphTool);
  const setSelectedNodeIds = useStore((state) => state.setSelectedNodeIds);
  const toggleSelectedNode = useStore((state) => state.toggleSelectedNode);
  const clearSelection = useStore((state) => state.clearSelection);
  const setGraphView = useStore((state) => state.setGraphView);
  const setNodeLayoutOffset = useStore((state) => state.setNodeLayoutOffset);
  const setNodeLayoutRadial = useStore((state) => state.setNodeLayoutRadial);
  const openContextMenu = useStore((state) => state.openContextMenu);

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
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const isPanningRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const dragStateRef = useRef<{
    nodeId: NodeId;
    startX: number;
    startY: number;
    startNodeX: number;
    startNodeY: number;
    baseOffsetX: number;
    baseOffsetY: number;
    mode: 'tree' | 'mindmap' | 'radial';
    radial?: {
      rootCenterX: number;
      rootCenterY: number;
      baseAngle: number;
      baseRadius: number;
      ancestorAngle: number;
      ancestorRadius: number;
      minRadius: number;
    };
  } | null>(null);
  const dragMovedRef = useRef(false);
  const isSelectingRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const baseSelectionRef = useRef<Set<NodeId>>(new Set());
  const transitionTimeoutRef = useRef<number | null>(null);

  const layoutOptions = useMemo(() => deriveLayoutOptions(settings), [settings]);

  useEffect(() => {
    viewRef.current = graphView;
  }, [graphView]);

  const clearCanvasTransition = useCallback(() => {
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    if (canvasRef.current) {
      canvasRef.current.style.transition = 'none';
    }
  }, []);

  const applyCanvasTransition = useCallback((durationMs: number) => {
    if (!canvasRef.current) return;
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
    }
    canvasRef.current.style.transition = `transform ${durationMs}ms ease-out`;
    transitionTimeoutRef.current = window.setTimeout(() => {
      if (canvasRef.current) canvasRef.current.style.transition = 'none';
      transitionTimeoutRef.current = null;
    }, durationMs);
  }, []);

  const root = tree?.getRoot() ?? null;
  const { nodeWidth, nodeHeight } = getLayoutConfig();

  const layout = useMemo(() => {
    if (!root) return null;
    switch (layoutOptions.mode) {
      case 'tree':
        return calculateLayout(root, layoutOptions.tree);
      case 'mindmap':
        return calculateMindmapLayout(root, layoutOptions.mindmap);
      default:
        return calculateRadialLayout(root, layoutOptions.radial);
    }
  }, [layoutOptions.mode, layoutOptions.mindmap, layoutOptions.radial, layoutOptions.tree, root]);

  const basePositions = layout?.positions ?? new Map<number, NodePosition>();
  const positions = useMemo(() => {
    if (basePositions.size === 0) return basePositions;
    if (layoutOptions.mode !== 'radial') {
      const offsetCache = new Map<NodeId, { x: number; y: number }>();
      const computeOffset = (node: NavigationNode): { x: number; y: number } => {
        if (offsetCache.has(node.id)) {
          return offsetCache.get(node.id)!;
        }
        const parent = node.getParent?.();
        const parentOffset = parent ? computeOffset(parent) : { x: 0, y: 0 };
        const layoutData = node.data.layout;
        const offsetX = typeof layoutData?.offsetX === 'number' ? layoutData.offsetX : 0;
        const offsetY = typeof layoutData?.offsetY === 'number' ? layoutData.offsetY : 0;
        const total = { x: parentOffset.x + offsetX, y: parentOffset.y + offsetY };
        offsetCache.set(node.id, total);
        return total;
      };
      const next = new Map<number, NodePosition>();
      basePositions.forEach((pos, id) => {
        const offset = computeOffset(pos.node);
        next.set(id, { ...pos, x: pos.x + offset.x, y: pos.y + offset.y });
      });
      return next;
    }

    if (!root) return basePositions;
    const rootPos = basePositions.get(root.id);
    if (!rootPos) return basePositions;
    const centerX = rootPos.x + nodeWidth / 2;
    const centerY = rootPos.y + nodeHeight / 2;
    const offsetCache = new Map<NodeId, { angle: number; radius: number }>();
    const computeRadialOffset = (node: NavigationNode): { angle: number; radius: number } => {
      if (offsetCache.has(node.id)) {
        return offsetCache.get(node.id)!;
      }
      const parent = node.getParent?.();
      const parentOffset = parent ? computeRadialOffset(parent) : { angle: 0, radius: 0 };
      const radial = node.data.layout?.radial;
      const angleDelta = typeof radial?.angleDelta === 'number' ? radial.angleDelta : 0;
      const radiusDelta = typeof radial?.radiusDelta === 'number' ? radial.radiusDelta : 0;
      const total = { angle: parentOffset.angle + angleDelta, radius: parentOffset.radius + radiusDelta };
      offsetCache.set(node.id, total);
      return total;
    };
    const next = new Map<number, NodePosition>();
    basePositions.forEach((pos, id) => {
      const offset = computeRadialOffset(pos.node);
      const nodeCenterX = pos.x + nodeWidth / 2;
      const nodeCenterY = pos.y + nodeHeight / 2;
      const baseDx = nodeCenterX - centerX;
      const baseDy = nodeCenterY - centerY;
      const baseRadius = Math.hypot(baseDx, baseDy);
      const baseAngle = Math.atan2(baseDy, baseDx);
      const minRadius = pos.node.isRoot?.() ? 0 : nodeWidth * 0.35;
      const radius = Math.max(minRadius, baseRadius + offset.radius);
      const angle = baseAngle + offset.angle;
      const x = centerX + radius * Math.cos(angle) - nodeWidth / 2;
      const y = centerY + radius * Math.sin(angle) - nodeHeight / 2;
      next.set(id, { ...pos, x, y });
    });
    return next;
  }, [basePositions, layoutOptions.mode, layoutVersion, nodeHeight, nodeWidth, root]);

  const bounds: CanvasBounds = useMemo(() => {
    if (!layout) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
    }
    return getCanvasBounds(positions);
  }, [layout, positions]);

  const nodes = useMemo(() => Array.from(positions.values()), [positions]);
  const searchSet = useMemo(() => new Set(search.results), [search.results]);
  const focusedSearchId = search.results[search.index];
  const pathNodeIds = useMemo(() => {
    if (!root || currentNodeId === null) return null;
    return getPathToNode(root, currentNodeId);
  }, [currentNodeId, root]);

  const connections = useMemo(
    () => buildConnections(root, positions, pathNodeIds, layoutOptions.mode, openNodeIds),
    [layoutOptions.mode, openNodeIds, pathNodeIds, positions, root],
  );

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
    if (!animate) {
      clearCanvasTransition();
    }
    setGraphView({ translateX, translateY, scale });
    if (animate) {
      applyCanvasTransition(300);
    }
  };

  const centerOnNode = (nodeId: NodeId, animate = true) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const pos = positions.get(nodeId);
    if (!pos) return;
    const rect = wrapper.getBoundingClientRect();
    const { scale } = viewRef.current;
    const nodeCenterX = pos.x + nodeWidth / 2;
    const nodeCenterY = pos.y + nodeHeight / 2;
    const nextTranslateX = rect.width / 2 - nodeCenterX * scale;
    const nextTranslateY = rect.height / 2 - nodeCenterY * scale;
    if (!animate) {
      clearCanvasTransition();
    }
    setGraphView({ translateX: nextTranslateX, translateY: nextTranslateY });
    if (animate) {
      applyCanvasTransition(300);
    }
  };

  useEffect(() => {
    if (!root || didInitView.current) return;
    didInitView.current = true;
    fitToView(false);
  }, [bounds.height, bounds.width, root]);

  useLayoutEffect(() => {
    if (searchActive) return;
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
  }, [currentNodeId, root, searchActive, tree, positions, nodeHeight, nodeWidth]);

  const prevSearchFocusRef = useRef<NodeId | null>(null);

  useLayoutEffect(() => {
    if (!searchActive) {
      prevSearchFocusRef.current = null;
      return;
    }
    if (!root) return;
    if (!focusedSearchId) return;
    if (prevSearchFocusRef.current === focusedSearchId) return;
    prevSearchFocusRef.current = focusedSearchId;
    centerOnNode(focusedSearchId, true);
  }, [focusedSearchId, root, searchActive, positions, nodeHeight, nodeWidth]);

  const zoomAt = useCallback((pointerX: number, pointerY: number, scaleFactor: number) => {
    const { translateX, translateY, scale } = viewRef.current;
    const nextScale = Math.min(3, Math.max(0.15, scale * scaleFactor));
    if (nextScale === scale) return;
    const canvasX = (pointerX - translateX) / scale;
    const canvasY = (pointerY - translateY) / scale;
    const nextTranslateX = pointerX - canvasX * nextScale;
    const nextTranslateY = pointerY - canvasY * nextScale;
    setGraphView({ translateX: nextTranslateX, translateY: nextTranslateY, scale: nextScale });
  }, [setGraphView]);

  const zoom = (direction: 'in' | 'out' | 'reset', animate = false) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (direction === 'reset') {
      fitToView(animate);
      return;
    }
    const rect = wrapper.getBoundingClientRect();
    const pointerX = rect.width / 2;
    const pointerY = rect.height / 2;
    const scaleFactor = direction === 'in' ? 1.25 : 0.8;
    if (animate) {
      applyCanvasTransition(180);
    } else {
      clearCanvasTransition();
    }
    zoomAt(pointerX, pointerY, scaleFactor);
  };

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('.graph-node')) return;
    if (!wrapperRef.current) return;
    clearCanvasTransition();

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

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    clearCanvasTransition();
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
  }, [clearCanvasTransition, setGraphView, zoomAt]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onWheel = (event: WheelEvent) => handleWheel(event);
    wrapper.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => {
      wrapper.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, [handleWheel, root]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    if (key === '+' || key === '=') {
      event.preventDefault();
      zoom('in', true);
    } else if (key === '-' || key === '_') {
      event.preventDefault();
      zoom('out', true);
    } else if (key === '0') {
      event.preventDefault();
      zoom('reset', true);
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

  const handleNodeClick = async (node: NavigationNode, event: ReactMouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
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
  };

  const handleNodePointerDown = (node: NavigationNode, event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.shiftKey) return;
    if (layoutOptions.mode === 'radial' && node.isRoot?.()) return;
    const startPos = positions.get(node.id);
    if (!startPos) return;
    event.stopPropagation();
    dragMovedRef.current = false;
    const startLayout = node.data.layout;
    const baseOffsetX = typeof startLayout?.offsetX === 'number' ? startLayout.offsetX : 0;
    const baseOffsetY = typeof startLayout?.offsetY === 'number' ? startLayout.offsetY : 0;
    dragStateRef.current = {
      nodeId: node.id,
      startX: event.clientX,
      startY: event.clientY,
      startNodeX: startPos.x,
      startNodeY: startPos.y,
      baseOffsetX,
      baseOffsetY,
      mode: layoutOptions.mode,
    };
    if (layoutOptions.mode === 'radial') {
      const rootPos = basePositions.get(root?.id ?? -1);
      const basePos = basePositions.get(node.id);
      if (!rootPos || !basePos) return;
      const rootCenterX = rootPos.x + nodeWidth / 2;
      const rootCenterY = rootPos.y + nodeHeight / 2;
      const baseCenterX = basePos.x + nodeWidth / 2;
      const baseCenterY = basePos.y + nodeHeight / 2;
      const baseDx = baseCenterX - rootCenterX;
      const baseDy = baseCenterY - rootCenterY;
      const baseAngle = Math.atan2(baseDy, baseDx);
      const baseRadius = Math.hypot(baseDx, baseDy);
      let ancestorAngle = 0;
      let ancestorRadius = 0;
      let parent = node.getParent?.();
      while (parent) {
        const radial = parent.data.layout?.radial;
        ancestorAngle += radial?.angleDelta ?? 0;
        ancestorRadius += radial?.radiusDelta ?? 0;
        parent = parent.getParent?.();
      }
      dragStateRef.current.radial = {
        rootCenterX,
        rootCenterY,
        baseAngle,
        baseRadius,
        ancestorAngle,
        ancestorRadius,
        minRadius: nodeWidth * 0.35,
      };
    }

    const handleMove = (moveEvent: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;
      const { scale } = viewRef.current;
      const deltaX = (moveEvent.clientX - state.startX) / scale;
      const deltaY = (moveEvent.clientY - state.startY) / scale;
      if (!dragMovedRef.current && Math.hypot(deltaX, deltaY) > 3) {
        dragMovedRef.current = true;
        setIsDraggingNode(true);
      }
      if (!dragMovedRef.current) return;
      if (state.mode === 'radial' && state.radial) {
        const targetCenterX = state.startNodeX + deltaX + nodeWidth / 2;
        const targetCenterY = state.startNodeY + deltaY + nodeHeight / 2;
        const desiredDx = targetCenterX - state.radial.rootCenterX;
        const desiredDy = targetCenterY - state.radial.rootCenterY;
        const desiredAngle = Math.atan2(desiredDy, desiredDx);
        const desiredRadius = Math.max(state.radial.minRadius, Math.hypot(desiredDx, desiredDy));
        const totalAngleDelta = desiredAngle - state.radial.baseAngle;
        const totalRadiusDelta = desiredRadius - state.radial.baseRadius;
        const nodeAngleDelta = totalAngleDelta - state.radial.ancestorAngle;
        const nodeRadiusDelta = totalRadiusDelta - state.radial.ancestorRadius;
        setNodeLayoutRadial(state.nodeId, nodeAngleDelta, nodeRadiusDelta);
      } else {
        setNodeLayoutOffset(state.nodeId, state.baseOffsetX + deltaX, state.baseOffsetY + deltaY);
      }
    };

    const handleUp = async () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      const state = dragStateRef.current;
      dragStateRef.current = null;
      setIsDraggingNode(false);
      if (!state) return;
      if (!dragMovedRef.current) return;
      const treeNode = tree?.findNodeById(state.nodeId);
      const layoutData = treeNode?.data.layout;
      if (!layoutData) return;
      try {
        if (state.mode === 'radial') {
          if (!layoutData.radial) return;
          await setNodeLayout(state.nodeId, { radial: layoutData.radial });
        } else {
          await setNodeLayout(state.nodeId, {
            offsetX: layoutData.offsetX,
            offsetY: layoutData.offsetY,
          });
        }
      } catch (error) {
        console.error('Failed to save node position:', error);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp, { once: true });
    window.addEventListener('pointercancel', handleUp, { once: true });
  };

  const handleNodeContextMenu = (node: NavigationNode, event: ReactMouseEvent<HTMLDivElement>) => {
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
        className={`graph-wrapper${isDraggingNode ? ' is-dragging' : ''}`}
        ref={wrapperRef}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
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
                onPointerDown={(event) => handleNodePointerDown(pos.node, event)}
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
          onZoom={(direction) => zoom(direction, true)}
        />
      </div>
    </div>
  );
}
