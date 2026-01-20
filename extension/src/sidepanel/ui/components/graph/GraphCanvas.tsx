import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import type { NodeId } from '../../../../shared/types/ids.js';
import type { NavigationNode } from '../../../../shared/types/node.js';
import type { Settings } from '../../../../shared/types/settings.js';
import type { TabState } from '../../../../shared/types/tabs.js';
import type { TreeUpdatedInput } from '../../../../shared/types/messages.js';
import type { TagDefinition } from '../../../../shared/types/tags.js';
import type { NavigationTree } from '../../../../background/state/nav-tree.js';
import { navigateTo, setNodeLayout } from '../../../api/tree.js';
import { PADDING } from '../../graph/layout/config.js';
import {
  calculateLayout,
  calculateMindmapLayout,
  calculateRadialLayout,
  getCanvasBounds,
} from '../../graph/layout/calculator.js';
import { deriveLayoutOptions } from '../../graph/layout/options.js';
import type { CanvasBounds, LayoutMode, NodePosition, ViewState } from '../../graph/types.js';
import GraphNode from './GraphNode.js';
import GraphZoomControls from './GraphZoomControls.js';
import { buildConnections, getPathBetweenNodes, getPathToNode } from './graph-utils.js';
import React from 'react';

type GraphTool = 'hand' | 'select';

type SearchState = {
  results: NodeId[];
  index: number;
  navStep: number;
  active: boolean;
};

type ContextMenuState =
  | {
      type: 'node';
      nodeId: NodeId;
      position: { x: number; y: number };
    }
  | {
      type: 'bulk';
      nodeIds: NodeId[];
      position: { x: number; y: number };
    };

type GraphCanvasProps = {
  tree: NavigationTree | null;
  currentNodeId: NodeId | null;
  openNodeIds: Set<NodeId>;
  nodeTabCounts: Record<NodeId, number>;
  tabStates: Record<NodeId, TabState>;
  search: SearchState;
  settings: Settings | null;
  showConnections: boolean;
  graphView: ViewState;
  tool: GraphTool;
  selectedNodeIds: Set<NodeId>;
  hoverNodeId: NodeId | null;
  layoutVersion: number;
  resetVersion: number;
  viewIntent: TreeUpdatedInput['view'] | null;
  tagDefs: Record<string, TagDefinition>;
  onGraphToolChange: (tool: GraphTool) => void;
  onSelectedNodeIdsChange: (ids: Set<NodeId>) => void;
  onToggleSelectedNode: (id: NodeId) => void;
  onClearSelection: () => void;
  onGraphViewChange: (view: Partial<ViewState>) => void;
  onNodeLayoutOffset: (nodeId: NodeId, offsetX: number, offsetY: number) => void;
  onNodeLayoutRadial: (nodeId: NodeId, angleDelta: number, radiusDelta: number) => void;
  onOpenContextMenu: (menu: ContextMenuState) => void;
  onClearViewIntent: () => void;
};

type SelectionBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export default function GraphCanvas({
  tree,
  currentNodeId,
  openNodeIds,
  nodeTabCounts,
  tabStates,
  search,
  settings,
  showConnections,
  graphView,
  tool,
  selectedNodeIds,
  hoverNodeId,
  layoutVersion,
  resetVersion,
  viewIntent,
  tagDefs,
  onGraphToolChange,
  onSelectedNodeIdsChange,
  onToggleSelectedNode,
  onClearSelection,
  onGraphViewChange,
  onNodeLayoutOffset,
  onNodeLayoutRadial,
  onOpenContextMenu,
  onClearViewIntent,
}: GraphCanvasProps) {
  const LOD_LOW_SCALE = 0.15;
  const searchActive = search.active;
  const searchNavStep = search.navStep;

  const lodClass = graphView.scale < LOD_LOW_SCALE ? ' lod-low' : '';

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef(graphView);
  const didInitView = useRef(false);
  const pendingViewRef = useRef<Partial<ViewState> | null>(null);
  const viewRafRef = useRef<number | null>(null);

  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [previewSelection, setPreviewSelection] = useState<Set<NodeId>>(new Set());
  const previewSelectionRef = useRef<Set<NodeId>>(new Set());
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const isPanningRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const selectionAnchorRef = useRef<NodeId | null>(null);
  const dragStateRef = useRef<{
    nodeId: NodeId;
    startX: number;
    startY: number;
    startNodeX: number;
    startNodeY: number;
    baseOffsetX: number;
    baseOffsetY: number;
    mode: LayoutMode;
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
  const panPointerStartRef = useRef({ x: 0, y: 0 });
  const panMovedRef = useRef(false);
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const baseSelectionRef = useRef<Set<NodeId>>(new Set());
  const selectionDragRef = useRef(false);
  const suppressClickRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const lastResetRef = useRef(0);
  const lastViewIntentRef = useRef<number | null>(null);
  const lastLayoutModeRef = useRef<LayoutMode | null>(null);
  const resetStepRef = useRef<{
    nodeId: NodeId;
    view: { translateX: number; translateY: number; scale: number };
  } | null>(null);

  const scheduleGraphView = useCallback(
    (view: Partial<ViewState>) => {
      viewRef.current = { ...viewRef.current, ...view };
      pendingViewRef.current = { ...(pendingViewRef.current ?? {}), ...view };
      if (viewRafRef.current !== null) return;
      viewRafRef.current = window.requestAnimationFrame(() => {
        const next = pendingViewRef.current;
        pendingViewRef.current = null;
        viewRafRef.current = null;
        if (next) onGraphViewChange(next);
      });
    },
    [onGraphViewChange],
  );

  useEffect(() => {
    return () => {
      if (viewRafRef.current !== null) {
        window.cancelAnimationFrame(viewRafRef.current);
        viewRafRef.current = null;
      }
    };
  }, []);

  const layoutOptions = useMemo(() => deriveLayoutOptions(settings), [settings]);
  const baseLayoutConfig =
    layoutOptions.mode === 'mindmap' ? layoutOptions.mindmap : layoutOptions.tree;
  const hideTreeRoot = settings?.layout?.tree?.hideRoot ?? false;

  useEffect(() => {
    viewRef.current = graphView;
  }, [graphView]);

  useEffect(() => {
    resetStepRef.current = null;
  }, [currentNodeId]);

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
  const { nodeWidth, nodeHeight } = baseLayoutConfig;

  const layout = useMemo(() => {
    if (!root) return null;
    switch (layoutOptions.mode) {
      case 'tree':
        return calculateLayout(root, layoutOptions.tree);
      case 'mindmap':
        return calculateMindmapLayout(root, layoutOptions.mindmap);
      default:
        return calculateRadialLayout(root, layoutOptions.radial, baseLayoutConfig);
    }
  }, [baseLayoutConfig, layoutOptions.mode, layoutOptions.mindmap, layoutOptions.radial, layoutOptions.tree, root]);

  const basePositions = layout?.positions ?? new Map<NodeId, NodePosition>();
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
      const next = new Map<NodeId, NodePosition>();
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
    const next = new Map<NodeId, NodePosition>();
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
    return getCanvasBounds(positions, nodeWidth, nodeHeight);
  }, [layout, nodeHeight, nodeWidth, positions]);

  const nodes = useMemo(() => {
    const list = Array.from(positions.values());
    if (layoutOptions.mode !== 'tree' || !root || !hideTreeRoot) return list;
    return list.filter((pos) => pos.node.id !== root.id);
  }, [hideTreeRoot, layoutOptions.mode, positions, root]);
  const searchSet = useMemo(() => new Set(search.results), [search.results]);
  const focusedSearchId = search.results[search.index];
  const display = useMemo(
    () => ({
      titleTruncation: settings?.titleTruncation ?? 'end',
      showFavicons: settings?.showFavicons ?? true,
      showUrls: settings?.showUrls ?? true,
      showTagDots: settings?.showTagDots ?? true,
      showTabCounts: settings?.showTabCounts ?? true,
      showAudioIndicators: settings?.showAudioIndicators ?? true,
      dimClosedNodes: settings?.dimClosedNodes ?? true,
    }),
    [settings],
  );

  const handleNodeClick = useCallback(async (node: NavigationNode, event: ReactMouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    if (tool === 'select') {
      try {
        await navigateTo(node);
      } catch (error) {
        console.error('Failed to navigate:', error);
      }
      return;
    }
    const isMeta = event.metaKey || event.ctrlKey;
    if (isMeta) {
      let anchorId = selectionAnchorRef.current;
      if (!anchorId && selectedNodeIds.size === 1) {
        anchorId = selectedNodeIds.values().next().value ?? null;
      }
      const anchorNode = anchorId ? tree?.findNodeById(anchorId) ?? null : null;
      if (anchorNode) {
        const nextSelection = getPathBetweenNodes(anchorNode, node);
        onSelectedNodeIdsChange(nextSelection);
      } else {
        selectionAnchorRef.current = node.id;
        onSelectedNodeIdsChange(new Set([node.id]));
      }
      return;
    }
    if (event.shiftKey) {
      const willRemove = selectedNodeIds.has(node.id) && selectedNodeIds.size === 1;
      onToggleSelectedNode(node.id);
      if (willRemove) {
        selectionAnchorRef.current = null;
      } else if (!selectionAnchorRef.current) {
        selectionAnchorRef.current = node.id;
      }
      return;
    }
    onSelectedNodeIdsChange(new Set([node.id]));
    selectionAnchorRef.current = node.id;
    try {
      await navigateTo(node);
    } catch (error) {
      console.error('Failed to navigate:', error);
    }
  }, [onSelectedNodeIdsChange, onToggleSelectedNode, selectedNodeIds, tool, tree]);

  const handleNodePointerDown = useCallback((node: NavigationNode, event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.shiftKey) return;
    if (event.metaKey || event.ctrlKey) return;
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
      if (!root) return;
      const rootPos = basePositions.get(root.id);
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
        onNodeLayoutRadial(state.nodeId, nodeAngleDelta, nodeRadiusDelta);
      } else {
        onNodeLayoutOffset(state.nodeId, state.baseOffsetX + deltaX, state.baseOffsetY + deltaY);
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
  }, [basePositions, layoutOptions.mode, nodeHeight, nodeWidth, onNodeLayoutOffset, onNodeLayoutRadial, positions, root, tree]);

  const handleNodeContextMenu = useCallback((node: NavigationNode, event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (selectedNodeIds.size > 0) {
      onOpenContextMenu({
        type: 'bulk',
        nodeIds: Array.from(selectedNodeIds),
        position: { x: event.clientX, y: event.clientY },
      });
      return;
    }
    onOpenContextMenu({
      type: 'node',
      nodeId: node.id,
      position: { x: event.clientX, y: event.clientY },
    });
  }, [onOpenContextMenu, selectedNodeIds]);

  const handleWrapperContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (selectedNodeIds.size === 0) return;
    event.preventDefault();
    onOpenContextMenu({
      type: 'bulk',
      nodeIds: Array.from(selectedNodeIds),
      position: { x: event.clientX, y: event.clientY },
    });
  };


  const nodeViewModels = useMemo(() => {
    const dimmedBySearch = searchActive;
    return nodes.map((pos) => {
      const id = pos.node.id;
      const isSearchMatch = searchSet.has(id);
      return {
        id,
        node: pos.node,
        position: pos,
        isCurrent: currentNodeId === id,
        isOpen: openNodeIds.has(id),
        tabCount: nodeTabCounts[id] ?? 0,
        tabState: tabStates[id],
        isSelected: selectedNodeIds.has(id),
        isPreview: previewSelection.has(id),
        isSearchMatch,
        isSearchFocused: focusedSearchId === id,
        isSearchDimmed: dimmedBySearch && !isSearchMatch,
        isHoverFocused: hoverNodeId === id,
      };
    });
  }, [
    currentNodeId,
    focusedSearchId,
    hoverNodeId,
    nodeTabCounts,
    nodes,
    openNodeIds,
    previewSelection,
    searchActive,
    searchSet,
    selectedNodeIds,
    tabStates,
  ]);
  const pathNodeIds = useMemo(() => {
    if (!root || currentNodeId === null) return null;
    return getPathToNode(root, currentNodeId);
  }, [currentNodeId, root]);

  const connections = useMemo(
    () =>
      showConnections
        ? buildConnections(
            root,
            positions,
            pathNodeIds,
            layoutOptions.mode,
            hideTreeRoot,
            nodeWidth,
            nodeHeight,
          )
        : [],
    [hideTreeRoot, layoutOptions.mode, nodeHeight, nodeWidth, pathNodeIds, positions, root, showConnections],
  );

  const getFitToViewView = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return null;
    const rect = wrapper.getBoundingClientRect();
    const treeWidth = bounds.maxX - bounds.minX + PADDING * 2;
    const treeHeight = bounds.maxY - bounds.minY + PADDING * 2;
    if (treeWidth <= 0 || treeHeight <= 0) return null;
    const scaleX = (rect.width * 0.9) / treeWidth;
    const scaleY = (rect.height * 0.9) / treeHeight;
    const scale = Math.min(scaleX, scaleY, 2);
    const translateX = (rect.width - treeWidth * scale) / 2 - (bounds.minX - PADDING) * scale;
    const translateY = (rect.height - treeHeight * scale) / 2 - (bounds.minY - PADDING) * scale;
    return { translateX, translateY, scale };
  }, [bounds.maxX, bounds.maxY, bounds.minX, bounds.minY]);

  const fitToView = (animate = false) => {
    const fitView = getFitToViewView();
    if (!fitView) return;
    if (!animate) {
      clearCanvasTransition();
    }
    viewRef.current = fitView;
    onGraphViewChange(fitView);
    if (animate) {
      applyCanvasTransition(300);
    }
  };

  const isViewClose = (
    a: { translateX: number; translateY: number; scale: number },
    b: { translateX: number; translateY: number; scale: number },
  ) => {
    const translateEpsilon = 0.5;
    const scaleEpsilon = 0.0005;
    return (
      Math.abs(a.translateX - b.translateX) <= translateEpsilon &&
      Math.abs(a.translateY - b.translateY) <= translateEpsilon &&
      Math.abs(a.scale - b.scale) <= scaleEpsilon
    );
  };

  const getCenteredView = (nodeId: NodeId) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return null;
    const pos = positions.get(nodeId);
    if (!pos) return null;
    const rect = wrapper.getBoundingClientRect();
    const scale = viewRef.current.scale;
    const nodeCenterX = pos.x + nodeWidth / 2;
    const nodeCenterY = pos.y + nodeHeight / 2;
    const translateX = rect.width / 2 - nodeCenterX * scale;
    const translateY = rect.height / 2 - nodeCenterY * scale;
    return { translateX, translateY, scale };
  };

  const centerOnNode = (nodeId: NodeId, animate = true): boolean => {
    const nextView = getCenteredView(nodeId);
    if (!nextView) return false;
    if (!animate) {
      clearCanvasTransition();
    }
    viewRef.current = nextView;
    onGraphViewChange(nextView);
    if (animate) {
      applyCanvasTransition(300);
    }
    return true;
  };

  useLayoutEffect(() => {
    if (!root) return;
    const mode = layoutOptions.mode;
    if (lastLayoutModeRef.current === null) {
      lastLayoutModeRef.current = mode;
      return;
    }
    if (lastLayoutModeRef.current === mode) return;
    const targetId = currentNodeId ?? root.id;
    if (targetId === null || targetId === undefined) return;
    const centered = centerOnNode(targetId, true);
    if (centered) {
      lastLayoutModeRef.current = mode;
    }
  }, [currentNodeId, layoutOptions.mode, nodeHeight, nodeWidth, positions, root]);

  useEffect(() => {
    if (!root || didInitView.current) return;
    didInitView.current = true;
    fitToView(false);
  }, [bounds.height, bounds.width, root]);

  useLayoutEffect(() => {
    if (!viewIntent) return;
    if (viewIntent.mode === 'soft' && (isDraggingNode || isPanningRef.current)) return;
    const intentId = viewIntent.intentId ?? 0;
    if (intentId !== 0 && lastViewIntentRef.current === intentId) return;
    if (viewIntent.fitToView) {
      lastViewIntentRef.current = intentId;
      fitToView(true);
      onClearViewIntent();
      return;
    }
    if (viewIntent.focusNodeId) {
      if (!positions.has(viewIntent.focusNodeId)) return;
      lastViewIntentRef.current = intentId;
      centerOnNode(viewIntent.focusNodeId, true);
      onClearViewIntent();
    }
  }, [
    onClearViewIntent,
    isDraggingNode,
    positions,
    viewIntent,
    nodeHeight,
    nodeWidth,
  ]);

  useEffect(() => {
    if (!root) return;
    if (resetVersion === 0) return;
    if (lastResetRef.current === resetVersion) return;
    lastResetRef.current = resetVersion;
    fitToView(true);
  }, [resetVersion, root]);

  const prevSearchFocusRef = useRef<NodeId | null>(null);
  const lastSearchNavStepRef = useRef(searchNavStep);

  useLayoutEffect(() => {
    if (!searchActive) {
      prevSearchFocusRef.current = null;
      lastSearchNavStepRef.current = searchNavStep;
      return;
    }
    if (isDraggingNode || isPanningRef.current || isSelectingRef.current) return;
    if (!root) return;
    if (!focusedSearchId) return;
    if (searchNavStep === lastSearchNavStepRef.current) return;
    if (prevSearchFocusRef.current === focusedSearchId) {
      lastSearchNavStepRef.current = searchNavStep;
      return;
    }
    prevSearchFocusRef.current = focusedSearchId;
    lastSearchNavStepRef.current = searchNavStep;
    centerOnNode(focusedSearchId, true);
  }, [
    focusedSearchId,
    isDraggingNode,
    root,
    searchActive,
    searchNavStep,
    positions,
    nodeHeight,
    nodeWidth,
  ]);

  const zoomAt = useCallback((pointerX: number, pointerY: number, scaleFactor: number) => {
    const { translateX, translateY, scale } = viewRef.current;
    const fitView = getFitToViewView();
    const minScale = Math.min(0.15, fitView?.scale ?? 0.15);
    const nextScale = Math.min(3, Math.max(minScale, scale * scaleFactor));
    if (nextScale === scale) return;
    const canvasX = (pointerX - translateX) / scale;
    const canvasY = (pointerY - translateY) / scale;
    const nextTranslateX = pointerX - canvasX * nextScale;
    const nextTranslateY = pointerY - canvasY * nextScale;
    scheduleGraphView({ translateX: nextTranslateX, translateY: nextTranslateY, scale: nextScale });
  }, [getFitToViewView, scheduleGraphView]);

  const handleResetZoom = (animate = false) => {
    const nodeId = currentNodeId;
    if (!nodeId) {
      resetStepRef.current = null;
      fitToView(animate);
      return;
    }
    const nextView = getCenteredView(nodeId);
    if (!nextView) {
      resetStepRef.current = null;
      fitToView(animate);
      return;
    }
    const snapshot = resetStepRef.current;
    if (snapshot && snapshot.nodeId === nodeId && isViewClose(viewRef.current, snapshot.view)) {
      resetStepRef.current = null;
      fitToView(animate);
      return;
    }
    if (animate) {
      applyCanvasTransition(300);
    } else {
      clearCanvasTransition();
    }
    viewRef.current = nextView;
    onGraphViewChange(nextView);
    resetStepRef.current = { nodeId, view: nextView };
  };

  const zoom = (direction: 'in' | 'out' | 'reset', animate = false) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (direction === 'reset') {
      handleResetZoom(animate);
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

  const finalizeSelection = () => {
    if (!isSelectingRef.current) return;
    isSelectingRef.current = false;
    const finalSelection = new Set(previewSelectionRef.current);
    onSelectedNodeIdsChange(finalSelection);
    if (finalSelection.size === 0) {
      selectionAnchorRef.current = null;
    } else if (finalSelection.size === 1) {
      selectionAnchorRef.current = finalSelection.values().next().value ?? null;
    } else if (selectionAnchorRef.current && !finalSelection.has(selectionAnchorRef.current)) {
      selectionAnchorRef.current = null;
    }
    setSelectionBox(null);
    previewSelectionRef.current = new Set();
    setPreviewSelection(new Set());
  };

  const clearSelectionState = useCallback(() => {
    onClearSelection();
    selectionAnchorRef.current = null;
    setPreviewSelection(new Set());
    setSelectionBox(null);
  }, [onClearSelection]);

  const releasePointerCapture = (target: HTMLDivElement | null, pointerId: number | null) => {
    if (!target || pointerId === null) return;
    try {
      if (target.hasPointerCapture(pointerId)) {
        target.releasePointerCapture(pointerId);
      }
    } catch {
      // ignore release errors
    }
  };

  const isGraphUiTarget = (target: HTMLElement) => target.closest('[data-graph-ui="true"]');

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (isGraphUiTarget(target)) return;
    if (target.closest('.graph-node')) return;
    if (!wrapperRef.current) return;
    clearCanvasTransition();
    suppressClickRef.current = false;
    selectionDragRef.current = false;
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);

    if (tool === 'hand') {
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = {
        x: event.clientX - viewRef.current.translateX,
        y: event.clientY - viewRef.current.translateY,
      };
      panPointerStartRef.current = { x: event.clientX, y: event.clientY };
      panMovedRef.current = false;
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

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!wrapperRef.current) return;
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== event.pointerId) {
      return;
    }
    const target = event.target as HTMLElement;
    if (isGraphUiTarget(target)) return;
    if (isPanningRef.current) {
      const nextTranslateX = event.clientX - panStartRef.current.x;
      const nextTranslateY = event.clientY - panStartRef.current.y;
      if (!panMovedRef.current) {
        const dx = event.clientX - panPointerStartRef.current.x;
        const dy = event.clientY - panPointerStartRef.current.y;
        if (Math.hypot(dx, dy) > 3) {
          panMovedRef.current = true;
          suppressClickRef.current = true;
        }
      }
      scheduleGraphView({ translateX: nextTranslateX, translateY: nextTranslateY });
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
      if (!selectionDragRef.current && (width > 3 || height > 3)) {
        selectionDragRef.current = true;
        suppressClickRef.current = true;
      }

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

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== event.pointerId) {
      return;
    }
    const target = event.target as HTMLElement;
    if (isGraphUiTarget(target)) {
      releasePointerCapture(event.currentTarget, activePointerIdRef.current);
      activePointerIdRef.current = null;
      return;
    }
    releasePointerCapture(event.currentTarget, activePointerIdRef.current);
    activePointerIdRef.current = null;
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
      panMovedRef.current = false;
      if (suppressClickRef.current) {
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
      return;
    }
    if (isSelectingRef.current) {
      finalizeSelection();
      selectionDragRef.current = false;
      if (suppressClickRef.current) {
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
    }
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== event.pointerId) {
      return;
    }
    const target = event.target as HTMLElement;
    if (isGraphUiTarget(target)) {
      releasePointerCapture(event.currentTarget, activePointerIdRef.current);
      activePointerIdRef.current = null;
      return;
    }
    releasePointerCapture(event.currentTarget, activePointerIdRef.current);
    activePointerIdRef.current = null;
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
      panMovedRef.current = false;
    }
    if (isSelectingRef.current) {
      finalizeSelection();
      selectionDragRef.current = false;
    }
    if (suppressClickRef.current) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
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
      scheduleGraphView({
        translateX: viewRef.current.translateX - event.deltaX,
        translateY: viewRef.current.translateY - event.deltaY,
      });
    }
  }, [clearCanvasTransition, scheduleGraphView, zoomAt]);

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
      onGraphToolChange('hand');
      clearSelectionState();
    } else if (key === 'v' || key === 'V') {
      event.preventDefault();
      onGraphToolChange('select');
      clearSelectionState();
    } else if (key === 'Escape') {
      event.preventDefault();
      clearSelectionState();
    }
  };



  const handleBackgroundClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (isGraphUiTarget(target)) return;
    if (target.closest('.graph-node')) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    clearSelectionState();
  };

  return (
    <div className="stack-container" id="stackContainer">
      <div
        className={`graph-wrapper${isDraggingNode ? ' is-dragging' : ''}${lodClass}`}
        ref={wrapperRef}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
        onContextMenu={handleWrapperContextMenu}
        onClick={handleBackgroundClick}
        style={{ cursor: tool === 'hand' ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
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
          {showConnections ? (
            <svg className="graph-connections" width={bounds.width} height={bounds.height}>
              {connections.map((connection) => (
                <path
                  key={connection.id}
                  d={connection.d}
                  className={`graph-connection ${connection.branchClass} ${connection.onPath ? 'on-path' : ''}`}
                />
              ))}
            </svg>
          ) : null}
          <div className="graph-nodes">
            {nodeViewModels.map((vm) => (
              <GraphNode
                key={vm.id}
                node={vm.node}
                position={vm.position}
                nodeWidth={nodeWidth}
                nodeHeight={nodeHeight}
                isCurrent={vm.isCurrent}
                isOpen={vm.isOpen}
                tabCount={vm.tabCount}
                tabState={vm.tabState}
                tagDefs={tagDefs}
                display={display}
                isSelected={vm.isSelected}
                isPreview={vm.isPreview}
                isSearchMatch={vm.isSearchMatch}
                isSearchFocused={vm.isSearchFocused}
                isSearchDimmed={vm.isSearchDimmed}
                isHoverFocused={vm.isHoverFocused}
                onClick={handleNodeClick}
                onContextMenu={handleNodeContextMenu}
                onPointerDown={handleNodePointerDown}
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
            onGraphToolChange(nextTool);
            clearSelectionState();
          }}
          onZoom={(direction) => zoom(direction, true)}
        />
      </div>
    </div>
  );
}
