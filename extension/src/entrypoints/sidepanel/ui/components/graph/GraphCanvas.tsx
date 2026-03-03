import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import type { NodeId } from '../../../../../shared/types/ids.js';
import type { NavigationNode } from '../../../../../shared/types/node.js';
import type { Settings } from '../../../../../shared/types/settings.js';
import type { TabState } from '../../../../../shared/types/tabs.js';
import type { TreeUpdatedInput } from '../../../../../shared/rpc/contracts.js';
import type { TagDefinition } from '../../../../../shared/types/tags.js';
import type { NavigationTree } from '../../../../../background/state/nav-tree.js';
import { navigateTo, setNodeLayoutBatch, reparentNode } from '../../../api/tree.js';
import { rpc } from '../../../../../shared/rpc/contracts.js';
import { fireAndForget } from '../../../api/background.js';
import { PADDING } from '../../graph/layout/config.js';
import {
  calculateLayout,
  calculateMindmapLayout,
  calculateRadialLayout,
  getCanvasBounds,
} from '../../graph/layout/calculator.js';
import { deriveLayoutOptions } from '../../graph/layout/options.js';
import type { CanvasBounds, LayoutMode, NodePosition, ViewState } from '../../graph/types.js';
import { createAnimationSpec, easeOutCubic, getAnimationProgress, lerp } from '../../graph/animation-utils.js';
import GraphZoomControls from './GraphZoomControls.js';
import { buildConnections, getPathToNode } from './graph-utils.js';
import {
  GraphPixiRenderer,
  type ConnectionQuality,
  type GraphRenderMetrics,
} from '../../graph/render/GraphPixiRenderer.js';
import type { NodeRenderModel, ParticleRenderModel } from '../../graph/render/types.js';
import { computeGraphGridTransform } from './grid-transform.js';
import {
  buildPreviewSelection,
  shouldEmitPreview,
} from './selection-utils.js';


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

type LayoutUpdate = {
  nodeId: NodeId;
  layout: {
    offsetX?: number;
    offsetY?: number;
    radial?: { angleDelta: number; radiusDelta: number };
  };
};

type LayoutUpdateMap = Map<NodeId, LayoutUpdate['layout']>;

type DragNodeState = {
  nodeId: NodeId;
  startNodeX: number;
  startNodeY: number;
  baseOffsetX: number;
  baseOffsetY: number;
  radial?: {
    rootCenterX: number;
    rootCenterY: number;
    baseAngle: number;
    baseRadius: number;
    ancestorAngle: number;
    ancestorRadius: number;
    minRadius: number;
  };
};

const LAYOUT_UPDATE_MS = 80;
const SELECTION_PREVIEW_MS = 40;

/** Distance (in world pixels) from the dragged node center to a candidate
 *  parent center at which the snap preview activates. */
const SNAP_RADIUS = 250;

function collectSubtreeIds(node: NavigationNode): Set<NodeId> {
  const ids = new Set<NodeId>();
  const walk = (n: NavigationNode) => {
    ids.add(n.id);
    for (const child of n.getChildren()) walk(child);
  };
  walk(node);
  return ids;
}

type DragReparentPreview = {
  draggedId: NodeId;
  originalParentId: NodeId;
  /** The node we'd reparent to on drop — null when detached but not near any target. */
  targetId: NodeId | null;
  /** IDs of the dragged subtree (used to exclude from snap candidates). */
  subtreeIds: Set<NodeId>;
};

type GraphCanvasProps = {
  tree: NavigationTree | null;
  treeUpdate: { reason: TreeUpdatedInput['reason']; at: number } | null;
  currentNodeId: NodeId | null;
  openNodeIds: Set<NodeId>;
  collapsedNodeIds: Set<NodeId>;
  collapseVersion: number;
  collapseAction: CollapseAction | null;
  nodeTabCounts: Record<NodeId, number>;
  tabStates: Record<NodeId, TabState>;
  search: SearchState;
  settings: Settings | null;
  showConnections: boolean;
  detailMode: 'full' | 'low' | 'dot';
  connectionQuality: ConnectionQuality;
  graphView: ViewState;
  tool: GraphTool;
  selectedNodeIds: Set<NodeId>;
  hoverNodeId: NodeId | null;
  resetVersion: number;
  viewIntent: TreeUpdatedInput['view'] | null;
  tagDefs: Record<string, TagDefinition>;
  onGraphToolChange: (tool: GraphTool) => void;
  onSelectedNodeIdsChange: (ids: Set<NodeId>) => void;
  onClearSelection: () => void;
  onGraphViewChange: (view: Partial<ViewState>) => void;
  onSetHoverNodeId: (nodeId: NodeId | null) => void;
  onOpenContextMenu: (menu: ContextMenuState) => void;
  onClearViewIntent: () => void;
  onExpandNodes: (nodeIds: NodeId[]) => void;
  onRenderMetrics: (metrics: GraphRenderMetrics) => void;
  editorActive: boolean;
  pickTarget: { type: 'duplicate'; sourceNodeId: NodeId } | null;
  onPickTargetComplete: () => void;
  fullViewEnabled: boolean;
};

type SelectionBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PointerInfo = {
  clientX: number;
  clientY: number;
  button: number;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
};

type PointerHitTarget = {
  nodeId: NodeId;
  target: 'node' | 'collapse-icon';
};

type NodeAnimationType = 'enter' | 'exit' | 'move';

type NodeAnimationState = {
  id: NodeId;
  type: NodeAnimationType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startTime: number;
  duration: number;
};

type OpenAnimationState = {
  id: NodeId;
  from: number;
  to: number;
  startTime: number;
  duration: number;
};

type ParticleState = {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  life: number;
  age: number;
  radius: number;
};

type CollapseAction = {
  kind: 'collapse' | 'expand';
  nodeIds: Set<NodeId>;
};

type CollapseScope = Map<NodeId, NodeId>;

const BASE_MOTION = createAnimationSpec(150);
const FAST_MOTION = createAnimationSpec(Math.max(60, Math.round(BASE_MOTION.duration / 2)));
const OPEN_ANIMATION_DURATION = 240;

const buildCollapseScope = (
  tree: NavigationTree | null,
  rootIds: Set<NodeId> | null,
): CollapseScope => {
  const scope: CollapseScope = new Map();
  if (!tree || !rootIds || rootIds.size === 0) return scope;
  const rootSet = new Set<NodeId>();
  rootIds.forEach((id) => {
    const node = tree.findNodeById(id);
    if (!node) return;
    rootSet.add(id);
  });
  if (rootSet.size === 0) return scope;

  const visit = (node: NavigationNode, rootId: NodeId) => {
    if (rootSet.has(node.id)) return;
    scope.set(node.id, rootId);
    node.getChildren().forEach((child) => visit(child, rootId));
  };

  rootSet.forEach((rootId) => {
    const rootNode = tree.findNodeById(rootId);
    if (!rootNode) return;
    rootNode.getChildren().forEach((child) => visit(child, rootId));
  });

  return scope;
};

export default function GraphCanvas({
  tree,
  treeUpdate,
  currentNodeId,
  openNodeIds,
  collapsedNodeIds,
  collapseVersion,
  collapseAction,
  nodeTabCounts,
  tabStates,
  search,
  settings,
  showConnections,
  detailMode,
  connectionQuality,
  graphView,
  tool,
  selectedNodeIds,
  hoverNodeId,
  resetVersion,
  viewIntent,
  tagDefs,
  onGraphToolChange,
  onSelectedNodeIdsChange,
  onClearSelection,
  onGraphViewChange,
  onSetHoverNodeId,
  onOpenContextMenu,
  onClearViewIntent,
  onExpandNodes,
  onRenderMetrics,
  editorActive,
  pickTarget,
  onPickTargetComplete,
  fullViewEnabled,
}: GraphCanvasProps) {
  const searchActive = search.active;
  const searchNavStep = search.navStep;
  const effectiveShowConnections = showConnections;

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const pixiHostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<GraphPixiRenderer | null>(null);
  const viewAnimationRef = useRef<number | null>(null);
  const viewRef = useRef(graphView);
  const didInitView = useRef(false);
  const pendingViewRef = useRef<Partial<ViewState> | null>(null);
  const viewRafRef = useRef<number | null>(null);
  const gridVarsRef = useRef({
    size: '',
    dotSize: '',
    offsetX: '',
    offsetY: '',
  });
  const emptyPositionsRef = useRef<Map<NodeId, NodePosition>>(new Map());
  const animationStatesRef = useRef<Map<NodeId, NodeAnimationState>>(new Map());
  const openAnimationStatesRef = useRef<Map<NodeId, OpenAnimationState>>(new Map());
  const openProgressRef = useRef<Map<NodeId, number>>(new Map());
  const animatedPositionsRef = useRef<Map<NodeId, { x: number; y: number }>>(new Map());
  const exitNodesRef = useRef<Map<NodeId, NodePosition>>(new Map());
  const prevPositionsRef = useRef<Map<NodeId, NodePosition>>(new Map());
  const exitParticleTimeoutsRef = useRef<Map<NodeId, number>>(new Map());
  const particleAnimationsRef = useRef<ParticleState[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const [animationVersion, setAnimationVersion] = useState(0);
  const animationDuration = BASE_MOTION.duration;
  const animationStagger = BASE_MOTION.stagger;
  const openAnimationDuration = OPEN_ANIMATION_DURATION;
  const invalidateAnimation = useCallback(() => {
    setAnimationVersion((version) => version + 1);
  }, []);
  const [particleVersion, setParticleVersion] = useState(0);
  const invalidateParticles = useCallback(() => {
    setParticleVersion((version) => version + 1);
  }, []);
  const lastAnimationTimeRef = useRef<number | null>(null);
  const animationNowRef = useRef<number | null>(null);
  const prevOpenNodesRef = useRef<Set<NodeId>>(new Set());
  const lastCollapseVersionRef = useRef<number>(-1);
  const animateTick = useCallback(
    function animateTick(time: number) {
      const deltaTime = lastAnimationTimeRef.current === null ? 16 : time - lastAnimationTimeRef.current;
      lastAnimationTimeRef.current = time;
      animationNowRef.current = time;
      const states = animationStatesRef.current;
      const entries = Array.from(states.entries());
      let nodesDirty = false;
      entries.forEach(([id, state]) => {
        const progress = getAnimationProgress(time, state.startTime, state.duration);
        if (progress.pending) {
          nodesDirty = true;
          return;
        }
        const x = lerp(state.startX, state.endX, progress.eased);
        const y = lerp(state.startY, state.endY, progress.eased);
        animatedPositionsRef.current.set(id, { x, y });
        nodesDirty = true;
        if (progress.done) {
          states.delete(id);
          animatedPositionsRef.current.delete(id);
          if (state.type === 'exit') {
            exitNodesRef.current.delete(id);
          }
        }
      });
      const openStates = openAnimationStatesRef.current;
      let openDirty = false;
      if (openStates.size > 0) {
        openStates.forEach((state, id) => {
          const progress = getAnimationProgress(time, state.startTime, state.duration);
          if (progress.pending) {
            openDirty = true;
            return;
          }
          const value = lerp(state.from, state.to, progress.eased);
          openProgressRef.current.set(id, value);
          openDirty = true;
          if (progress.done) {
            openStates.delete(id);
          }
        });
      }
      if (nodesDirty || openDirty) {
        invalidateAnimation();
      }
      const particles = particleAnimationsRef.current;
      let particlesDirty = false;
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i]!;
        particle.age += deltaTime;
        particlesDirty = true;
        if (particle.age >= particle.life) {
          particles.splice(i, 1);
          particlesDirty = true;
        }
      }
      if (particlesDirty) {
        invalidateParticles();
      }
      const needsLoop = states.size > 0 || particles.length > 0 || openStates.size > 0;
      if (needsLoop) {
        animationFrameRef.current = window.requestAnimationFrame(animateTick);
      } else {
        animationFrameRef.current = null;
        lastAnimationTimeRef.current = null;
        animationNowRef.current = null;
      }
    },
    [invalidateAnimation, invalidateParticles],
  );

  const startAnimationLoop = useCallback(() => {
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = window.requestAnimationFrame(animateTick);
  }, [animateTick]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        lastAnimationTimeRef.current = null;
        animationNowRef.current = null;
      }
      exitParticleTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      exitParticleTimeoutsRef.current.clear();
    };
  }, []);

  const selectionBoxRef = useRef<HTMLDivElement | null>(null);
  const previewSelectionRef = useRef<Set<NodeId>>(new Set());
  const selectionWorldRectRef = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const selectionComputeHandleRef = useRef<number | null>(null);
  const selectionComputeDirtyRef = useRef(false);
  const selectionPreviewLastRunRef = useRef(0);
  const positionsRef = useRef<Map<NodeId, NodePosition>>(new Map());
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [dragPreview, setDragPreview] = useState<LayoutUpdateMap | null>(null);
  const layoutSendRef = useRef<{
    lastSent: number;
    timer: number | null;
    pending: LayoutUpdateMap | null;
  }>({ lastSent: 0, timer: null, pending: null });
  const isPanningRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const pointerDownNodeIdRef = useRef<NodeId | null>(null);
  const pointerDownTargetRef = useRef<PointerHitTarget | null>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    mode: LayoutMode;
    nodes: DragNodeState[];
    latestLayouts: LayoutUpdateMap;
  } | null>(null);
  const dragMovedRef = useRef(false);
  const nodeDragJustEndedRef = useRef(false);
  const dragReparentRef = useRef<DragReparentPreview | null>(null);
  const [dragReparentTarget, setDragReparentTarget] = useState<{
    draggedId: NodeId;
    originalParentId: NodeId;
    targetId: NodeId | null;
  } | null>(null);
  const isSelectingRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panPointerStartRef = useRef({ x: 0, y: 0 });
  const panMovedRef = useRef(false);
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const baseSelectionRef = useRef<Set<NodeId>>(new Set());
  const selectionModeRef = useRef<'replace' | 'add' | 'remove'>('replace');
  const selectionDragRef = useRef(false);
  const suppressClickRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const lastHoverNodeIdRef = useRef<NodeId | null>(null);
  const lastResetRef = useRef(0);
  const lastViewIntentRef = useRef<number | null>(null);
  const lastLayoutModeRef = useRef<LayoutMode | null>(null);
  const resetStepRef = useRef<{
    nodeId: NodeId;
    view: { translateX: number; translateY: number; scale: number };
  } | null>(null);

  const cancelSelectionCompute = useCallback(() => {
    const handle = selectionComputeHandleRef.current;
    if (handle === null) return;
    window.clearTimeout(handle);
    selectionComputeHandleRef.current = null;
    selectionComputeDirtyRef.current = false;
  }, []);

  useEffect(() => {
    return () => cancelSelectionCompute();
  }, [cancelSelectionCompute]);

  const hideSelectionBox = useCallback(() => {
    const box = selectionBoxRef.current;
    if (!box) return;
    box.style.opacity = '0';
    box.style.width = '0px';
    box.style.height = '0px';
  }, []);

  const updateSelectionBox = useCallback((boxState: SelectionBox) => {
    const box = selectionBoxRef.current;
    if (!box) return;
    box.style.opacity = '1';
    box.style.left = `${boxState.left}px`;
    box.style.top = `${boxState.top}px`;
    box.style.width = `${boxState.width}px`;
    box.style.height = `${boxState.height}px`;
  }, []);

  const computeSelectionPreview = useCallback(() => {
    if (!isSelectingRef.current) return;
    const renderer = rendererRef.current;
    const rect = selectionWorldRectRef.current;
    if (!renderer || !rect) return;
    const hits = renderer.queryVisibleNodesInWorldRect(rect);
    const preview = buildPreviewSelection(
      baseSelectionRef.current,
      hits,
      selectionModeRef.current,
      positionsRef.current,
    );
    if (shouldEmitPreview(previewSelectionRef.current, preview)) {
      previewSelectionRef.current = preview;
      renderer.setSelectionPreview(preview);
    }
  }, []);

  const scheduleSelectionPreview = useCallback(() => {
    if (selectionComputeHandleRef.current !== null) {
      selectionComputeDirtyRef.current = true;
      return;
    }
    const now = performance.now();
    const elapsed = now - selectionPreviewLastRunRef.current;
    const delay = Math.max(0, SELECTION_PREVIEW_MS - elapsed);
    const run = () => {
      selectionComputeHandleRef.current = null;
      if (!isSelectingRef.current) return;
      selectionPreviewLastRunRef.current = performance.now();
      computeSelectionPreview();
      if (selectionComputeDirtyRef.current) {
        selectionComputeDirtyRef.current = false;
        scheduleSelectionPreview();
      }
    };
    selectionComputeHandleRef.current = window.setTimeout(run, delay);
  }, [computeSelectionPreview]);

  const applyGridTransform = useCallback((view: ViewState) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const grid = computeGraphGridTransform(view);
    const sizeValue = `${grid.size.toFixed(3)}px`;
    const dotValue = `${grid.dotSize.toFixed(3)}px`;
    const offsetXValue = `${grid.offsetX.toFixed(3)}px`;
    const offsetYValue = `${grid.offsetY.toFixed(3)}px`;
    const prev = gridVarsRef.current;
    if (
      prev.size === sizeValue &&
      prev.dotSize === dotValue &&
      prev.offsetX === offsetXValue &&
      prev.offsetY === offsetYValue
    ) {
      return;
    }
    wrapper.style.setProperty('--graph-grid-size', sizeValue);
    wrapper.style.setProperty('--graph-grid-dot-size', dotValue);
    wrapper.style.setProperty('--graph-grid-offset-x', offsetXValue);
    wrapper.style.setProperty('--graph-grid-offset-y', offsetYValue);
    gridVarsRef.current = {
      size: sizeValue,
      dotSize: dotValue,
      offsetX: offsetXValue,
      offsetY: offsetYValue,
    };
  }, []);

  const scheduleGraphView = useCallback(
    (view: Partial<ViewState>) => {
      viewRef.current = { ...viewRef.current, ...view };
      pendingViewRef.current = { ...(pendingViewRef.current ?? {}), ...view };
      if (viewRafRef.current !== null) return;
      viewRafRef.current = window.requestAnimationFrame(() => {
        const next = pendingViewRef.current;
        pendingViewRef.current = null;
        viewRafRef.current = null;
        if (next) {
          onGraphViewChange(next);
          rendererRef.current?.setView(viewRef.current);
          applyGridTransform(viewRef.current);
        }
      });
    },
    [applyGridTransform, onGraphViewChange],
  );

  useEffect(() => {
    return () => {
      if (viewRafRef.current !== null) {
        window.cancelAnimationFrame(viewRafRef.current);
        viewRafRef.current = null;
      }
      if (viewAnimationRef.current !== null) {
        window.cancelAnimationFrame(viewAnimationRef.current);
        viewAnimationRef.current = null;
      }
    };
  }, []);

  const layoutOptions = useMemo(() => deriveLayoutOptions(settings), [settings]);
  const baseLayoutConfig =
    layoutOptions.mode === 'mindmap' ? layoutOptions.mindmap : layoutOptions.tree;
  const hideTreeRoot = settings?.layout?.tree?.hideRoot ?? false;
  const root = tree?.getRoot() ?? null;
  const { nodeWidth, nodeHeight } = baseLayoutConfig;
  const getVisibleChildren = useCallback(
    (node: NavigationNode) => (collapsedNodeIds.has(node.id) ? [] : node.getChildren?.() ?? []),
    [collapsedNodeIds],
  );

  useEffect(() => {
    viewRef.current = graphView;
    rendererRef.current?.setView(graphView);
    applyGridTransform(graphView);
  }, [applyGridTransform, graphView]);

  useEffect(() => {
    const host = pixiHostRef.current;
    if (!host) return;
    const renderer = new GraphPixiRenderer(host);
    rendererRef.current = renderer;
    renderer.setView(viewRef.current);
    renderer.setDetailMode(detailMode);
    renderer.setConnectionQuality(connectionQuality);
    renderer.setMetricsListener(onRenderMetrics);
    applyGridTransform(viewRef.current);
    return () => {
      renderer.setMetricsListener(null);
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [applyGridTransform]);

  useEffect(() => {
    rendererRef.current?.setSelectedNodeIds(selectedNodeIds);
  }, [selectedNodeIds]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const resizeObserver = new ResizeObserver(() => {
      rendererRef.current?.resizeToHost();
      rendererRef.current?.setView(viewRef.current);
      applyGridTransform(viewRef.current);
    });
    resizeObserver.observe(wrapper);
    return () => resizeObserver.disconnect();
  }, [applyGridTransform]);

  useEffect(() => {
    const observer = new MutationObserver(() => rendererRef.current?.refreshTheme());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    resetStepRef.current = null;
  }, [currentNodeId]);

  const flushLayoutUpdates = useCallback(async (updates: LayoutUpdateMap) => {
    try {
      await setNodeLayoutBatch(
        Array.from(updates.entries()).map(([nodeId, layout]) => ({
          nodeId,
          ...layout,
        })),
      );
    } catch (error) {
      console.error('Failed to save node position:', error);
    }
  }, []);

  const queueLayoutUpdates = useCallback(
    (updates: LayoutUpdateMap, immediate = false) => {
      if (updates.size === 0) return;
      const state = layoutSendRef.current;
      if (!state.pending) {
        state.pending = new Map();
      }
      updates.forEach((layout, nodeId) => {
        state.pending?.set(nodeId, layout);
      });
      const now = performance.now();
      const elapsed = now - state.lastSent;
      const canSendNow = immediate || elapsed >= LAYOUT_UPDATE_MS;
      if (canSendNow) {
        if (state.timer !== null) {
          window.clearTimeout(state.timer);
          state.timer = null;
        }
        state.lastSent = now;
        const next = state.pending;
        state.pending = null;
        if (next) void flushLayoutUpdates(next);
        return;
      }
      if (state.timer !== null) return;
      const delay = Math.max(0, LAYOUT_UPDATE_MS - elapsed);
      state.timer = window.setTimeout(() => {
        state.timer = null;
        const next = state.pending;
        state.pending = null;
        if (!next) return;
        state.lastSent = performance.now();
        void flushLayoutUpdates(next);
      }, delay);
    },
    [flushLayoutUpdates],
  );

  useEffect(() => {
    return () => {
      const state = layoutSendRef.current;
      if (state.timer !== null) {
        window.clearTimeout(state.timer);
        state.timer = null;
      }
      state.pending = null;
    };
  }, []);

  const cancelViewAnimation = useCallback(() => {
    if (viewAnimationRef.current !== null) {
      window.cancelAnimationFrame(viewAnimationRef.current);
      viewAnimationRef.current = null;
    }
  }, []);

  const animateViewTo = useCallback(
    (target: ViewState, durationMs: number) => {
      cancelViewAnimation();
      const start = performance.now();
      const from = viewRef.current;
      const animate = (time: number) => {
        const progress = getAnimationProgress(time, start, durationMs);
        const next: ViewState = {
          translateX: lerp(from.translateX, target.translateX, progress.eased),
          translateY: lerp(from.translateY, target.translateY, progress.eased),
          scale: lerp(from.scale, target.scale, progress.eased),
        };
        viewRef.current = next;
        onGraphViewChange(next);
        rendererRef.current?.setView(next);
        applyGridTransform(next);
        if (!progress.done) {
          viewAnimationRef.current = window.requestAnimationFrame(animate);
        } else {
          viewAnimationRef.current = null;
        }
      };
      viewAnimationRef.current = window.requestAnimationFrame(animate);
    },
    [applyGridTransform, cancelViewAnimation, onGraphViewChange],
  );

  const layout = useMemo(() => {
    if (!root) return null;
    switch (layoutOptions.mode) {
      case 'tree':
        return calculateLayout(root, layoutOptions.tree, getVisibleChildren);
      case 'mindmap':
        return calculateMindmapLayout(root, layoutOptions.mindmap, getVisibleChildren);
      default:
        return calculateRadialLayout(root, layoutOptions.radial, baseLayoutConfig, getVisibleChildren);
    }
  }, [
    baseLayoutConfig,
    getVisibleChildren,
    layoutOptions.mode,
    layoutOptions.mindmap,
    layoutOptions.radial,
    layoutOptions.tree,
    root,
  ]);

  const basePositions = layout?.positions ?? emptyPositionsRef.current;
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
        const previewLayout = dragPreview?.get(node.id);
        const previewOffsetX =
          typeof previewLayout?.offsetX === 'number' ? previewLayout.offsetX : null;
        const previewOffsetY =
          typeof previewLayout?.offsetY === 'number' ? previewLayout.offsetY : null;
        const extra = {
          x: previewOffsetX !== null ? previewOffsetX - offsetX : 0,
          y: previewOffsetY !== null ? previewOffsetY - offsetY : 0,
        };
        const total = {
          x: parentOffset.x + offsetX + extra.x,
          y: parentOffset.y + offsetY + extra.y,
        };
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
      const previewLayout = dragPreview?.get(node.id);
      const previewRadial = previewLayout?.radial;
      const previewAngle = typeof previewRadial?.angleDelta === 'number' ? previewRadial.angleDelta : null;
      const previewRadius = typeof previewRadial?.radiusDelta === 'number' ? previewRadial.radiusDelta : null;
      const extra = {
        angle: previewAngle !== null ? previewAngle - angleDelta : 0,
        radius: previewRadius !== null ? previewRadius - radiusDelta : 0,
      };
      const total = {
        angle: parentOffset.angle + angleDelta + extra.angle,
        radius: parentOffset.radius + radiusDelta + extra.radius,
      };
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
  }, [basePositions, dragPreview, layoutOptions.mode, nodeHeight, nodeWidth, root]);
  positionsRef.current = positions;

  const spawnExitParticles = useCallback(
    (pos: NodePosition) => {
      const centerX = pos.x + nodeWidth / 2;
      const centerY = pos.y + nodeHeight / 2;
      const particles = particleAnimationsRef.current;
      const count = 8;
      const now = performance.now();
      const baseDist = Math.max(nodeWidth, nodeHeight);
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const distance = baseDist * (0.5 + Math.random() * 0.8);
        particles.push({
          id: `${pos.node.id}-exit-${now}-${i}`,
          startX: centerX,
          startY: centerY,
          endX: centerX + Math.cos(angle) * distance,
          endY: centerY + Math.sin(angle) * distance,
          life: animationDuration,
          age: 0,
          radius: Math.random() * 3 + 1.5,
        });
      }
      invalidateParticles();
      startAnimationLoop();
    },
    [animationDuration, invalidateParticles, nodeHeight, nodeWidth, startAnimationLoop],
  );

  const queueNodeAnimation = useCallback(
    (state: NodeAnimationState) => {
      animationStatesRef.current.set(state.id, state);
      animatedPositionsRef.current.set(state.id, { x: state.startX, y: state.startY });
      invalidateAnimation();
      startAnimationLoop();
    },
    [invalidateAnimation, startAnimationLoop],
  );

  const startEnter = useCallback(
    (
      pos: NodePosition,
      startCenter: { x: number; y: number },
      delayMs = 0,
      durationMs = animationDuration,
    ) => {
      const id = pos.node.id;
      animationStatesRef.current.delete(id);
      exitNodesRef.current.delete(id);
      const startX = startCenter.x - nodeWidth / 2;
      const startY = startCenter.y - nodeHeight / 2;
      const state: NodeAnimationState = {
        id,
        type: 'enter',
        startX,
        startY,
        endX: pos.x,
        endY: pos.y,
        startTime: performance.now() + delayMs,
        duration: durationMs,
      };
      queueNodeAnimation(state);
    },
    [animationDuration, nodeHeight, nodeWidth, queueNodeAnimation],
  );

  const startExit = useCallback(
    (
      pos: NodePosition,
      endCenter: { x: number; y: number },
      delayMs = 0,
      durationMs = animationDuration,
      options: { spawnParticles?: boolean } = {},
    ) => {
      const id = pos.node.id;
      if (exitNodesRef.current.has(id)) return;
      animationStatesRef.current.delete(id);
      const startX = pos.x;
      const startY = pos.y;
      const endX = endCenter.x - nodeWidth / 2;
      const endY = endCenter.y - nodeHeight / 2;
      const state: NodeAnimationState = {
        id,
        type: 'exit',
        startX,
        startY,
        endX,
        endY,
        startTime: performance.now() + delayMs,
        duration: durationMs,
      };
      queueNodeAnimation(state);
      exitNodesRef.current.set(id, { ...pos });
      const shouldSpawnParticles = options.spawnParticles !== false;
      const existingTimeout = exitParticleTimeoutsRef.current.get(id);
      if (existingTimeout !== undefined) {
        window.clearTimeout(existingTimeout);
        exitParticleTimeoutsRef.current.delete(id);
      }
      if (!shouldSpawnParticles) {
        return;
      }
      if (delayMs <= 0) {
        spawnExitParticles(pos);
      } else {
        const timeoutId = window.setTimeout(() => {
          exitParticleTimeoutsRef.current.delete(id);
          spawnExitParticles(pos);
        }, delayMs);
        exitParticleTimeoutsRef.current.set(id, timeoutId);
      }
    },
    [animationDuration, nodeHeight, nodeWidth, queueNodeAnimation, spawnExitParticles],
  );

  const startMove = useCallback(
    (
      id: NodeId,
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      durationMs = animationDuration,
    ) => {
      animationStatesRef.current.delete(id);
      const state: NodeAnimationState = {
        id,
        type: 'move',
        startX: fromX,
        startY: fromY,
        endX: toX,
        endY: toY,
        startTime: performance.now(),
        duration: durationMs,
      };
      queueNodeAnimation(state);
    },
    [animationDuration, queueNodeAnimation],
  );

  useLayoutEffect(() => {
    const prev = prevPositionsRef.current;
    const current = new Map(positions);
    if (prev.size === 0) {
      prevPositionsRef.current = current;
      return;
    }
    const pendingCollapseAction =
      collapseVersion !== lastCollapseVersionRef.current ? collapseAction : null;
    const collapseScope = pendingCollapseAction
      ? buildCollapseScope(tree ?? null, pendingCollapseAction.nodeIds)
      : null;
    const collapseCenters = new Map<NodeId, { x: number; y: number }>();
    const getCollapseCenter = (rootId: NodeId, fallback: { x: number; y: number }) => {
      const cached = collapseCenters.get(rootId);
      if (cached) return cached;
      const rootPos = current.get(rootId);
      const center = rootPos
        ? { x: rootPos.x + nodeWidth / 2, y: rootPos.y + nodeHeight / 2 }
        : fallback;
      collapseCenters.set(rootId, center);
      return center;
    };
    const suppressMoveAnimations = isDraggingNode || (dragPreview?.size ?? 0) > 0;
    const enteringIds = new Set<NodeId>();
    const exitingIds = new Set<NodeId>();
    current.forEach((_pos, id) => {
      if (!prev.has(id)) enteringIds.add(id);
    });
    prev.forEach((_pos, id) => {
      if (!current.has(id)) exitingIds.add(id);
    });

    const enterDepthCache = new Map<NodeId, number>();
    const getEnterDepth = (node: NavigationNode): number => {
      if (!enteringIds.has(node.id)) return 0;
      const cached = enterDepthCache.get(node.id);
      if (cached !== undefined) return cached;
      const parent = node.getParent?.();
      const depth = parent && enteringIds.has(parent.id) ? getEnterDepth(parent) + 1 : 0;
      enterDepthCache.set(node.id, depth);
      return depth;
    };

    const exitDepthCache = new Map<NodeId, number>();
    const getExitDepth = (node: NavigationNode): number => {
      if (!exitingIds.has(node.id)) return -1;
      const cached = exitDepthCache.get(node.id);
      if (cached !== undefined) return cached;
      let maxChildDepth = -1;
      node.getChildren().forEach((child) => {
        if (!exitingIds.has(child.id)) return;
        maxChildDepth = Math.max(maxChildDepth, getExitDepth(child));
      });
      const depth = maxChildDepth + 1;
      exitDepthCache.set(node.id, depth);
      return depth;
    };

    const currentRootPos = root ? current.get(root.id) : undefined;
    const currentRootCenter = {
      x: currentRootPos ? currentRootPos.x + nodeWidth / 2 : 0,
      y: currentRootPos ? currentRootPos.y + nodeHeight / 2 : 0,
    };
    current.forEach((pos, id) => {
      if (enteringIds.has(id)) {
        const isExpandNode =
          pendingCollapseAction?.kind === 'expand' && collapseScope?.has(id);
        const parent = pos.node.getParent?.();
        const parentPos = parent ? current.get(parent.id) : undefined;
        const startCenter = parentPos
          ? { x: parentPos.x + nodeWidth / 2, y: parentPos.y + nodeHeight / 2 }
          : currentRootCenter;
        const depth = getEnterDepth(pos.node);
        const stagger = isExpandNode ? FAST_MOTION.stagger : animationStagger;
        const durationMs = isExpandNode ? FAST_MOTION.duration : animationDuration;
        startEnter(pos, startCenter, depth * stagger, durationMs);
        return;
      }
      const prevPos = prev.get(id);
      if (!prevPos) return;
      const dx = pos.x - prevPos.x;
      const dy = pos.y - prevPos.y;
      if (dx * dx + dy * dy > 1 && !suppressMoveAnimations) {
        startMove(id, prevPos.x, prevPos.y, pos.x, pos.y);
      }
    });

    const isDelete = treeUpdate?.reason === 'delete';
    const popDuration = Math.max(120, Math.round(animationDuration * 0.4));
    prev.forEach((pos, id) => {
      if (!exitingIds.has(id)) return;
      const collapseRootId =
        pendingCollapseAction?.kind === 'collapse' ? collapseScope?.get(id) : undefined;
      if (collapseRootId) {
        const endCenter = getCollapseCenter(collapseRootId, {
          x: pos.x + nodeWidth / 2,
          y: pos.y + nodeHeight / 2,
        });
        const delayMs = getExitDepth(pos.node) * FAST_MOTION.stagger;
        startExit(pos, endCenter, delayMs, FAST_MOTION.duration, { spawnParticles: false });
        return;
      }
      if (isDelete) {
        const parent = pos.node.getParent?.();
        if (parent && exitingIds.has(parent.id)) {
          return;
        }
      }
      const endCenter = { x: pos.x + nodeWidth / 2, y: pos.y + nodeHeight / 2 };
      const delayMs = isDelete ? 0 : getExitDepth(pos.node) * animationStagger;
      startExit(pos, endCenter, delayMs, isDelete ? popDuration : animationDuration);
    });
    prevPositionsRef.current = current;
    if (pendingCollapseAction) {
      lastCollapseVersionRef.current = collapseVersion;
    }
  }, [
    animationDuration,
    animationStagger,
    collapseAction,
    collapseVersion,
    dragPreview,
    isDraggingNode,
    nodeHeight,
    nodeWidth,
    positions,
    root,
    tree,
    startEnter,
    startExit,
    startMove,
    treeUpdate?.reason,
  ]);

  const bounds: CanvasBounds = useMemo(() => {
    if (!layout) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
    }
    return getCanvasBounds(positions, nodeWidth, nodeHeight);
  }, [layout, nodeHeight, nodeWidth, positions]);

  const displayNodes = useMemo(() => {
    const list = Array.from(positions.values());
    exitNodesRef.current.forEach((pos) => list.push(pos));
    return list;
  }, [positions, animationVersion]);
  const pendingEnterIds = useMemo(() => {
    if (animationStatesRef.current.size === 0) return new Set<NodeId>();
    const now = animationNowRef.current ?? performance.now();
    const pending = new Set<NodeId>();
    animationStatesRef.current.forEach((state, id) => {
      if (state.type === 'enter' && state.startTime > now) {
        pending.add(id);
      }
    });
    return pending;
  }, [animationVersion]);
  const visibleDisplayNodes = useMemo(() => {
    return displayNodes.filter((pos) => !pendingEnterIds.has(pos.node.id));
  }, [displayNodes, pendingEnterIds]);
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

  useLayoutEffect(() => {
    const activeIds = new Set<NodeId>();
    positions.forEach((_pos, id) => {
      activeIds.add(id);
    });
    exitNodesRef.current.forEach((_pos, id) => {
      activeIds.add(id);
    });

    const openStates = openAnimationStatesRef.current;
    const openProgress = openProgressRef.current;

    if (activeIds.size === 0) {
      openProgress.clear();
      openStates.clear();
      prevOpenNodesRef.current = new Set<NodeId>();
      return;
    }

    if (!display.dimClosedNodes) {
      activeIds.forEach((id) => {
        openProgress.set(id, 1);
      });
      openProgress.forEach((_value, id) => {
        if (!activeIds.has(id)) {
          openProgress.delete(id);
        }
      });
      openStates.clear();
      prevOpenNodesRef.current = new Set(openNodeIds);
      invalidateAnimation();
      return;
    }

    const prevOpen = prevOpenNodesRef.current;
    const isInitial = prevOpen.size === 0 && openProgress.size === 0;
    const now = performance.now();

    activeIds.forEach((id) => {
      const target = openNodeIds.has(id) ? 1 : 0;
      if (isInitial) {
        openProgress.set(id, target);
        return;
      }
      const current = openProgress.get(id) ?? (prevOpen.has(id) ? 1 : target);
      if (current === target) return;
      openStates.set(id, {
        id,
        from: current,
        to: target,
        startTime: now,
        duration: openAnimationDuration,
      });
    });

    openProgress.forEach((_value, id) => {
      if (!activeIds.has(id)) {
        openProgress.delete(id);
        openStates.delete(id);
      }
    });

    prevOpenNodesRef.current = new Set(openNodeIds);
    if (openStates.size > 0) {
      invalidateAnimation();
      startAnimationLoop();
    }
  }, [display.dimClosedNodes, invalidateAnimation, openNodeIds, positions, startAnimationLoop]);

  const handleNodeClick = useCallback(async (node: NavigationNode) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }

    // Pick-target mode: clicking a node completes the operation
    if (pickTarget) {
      if (pickTarget.type === 'duplicate') {
        fireAndForget(rpc.duplicateSubtree({
          nodeId: pickTarget.sourceNodeId,
          targetParentId: node.id,
        }));
      }
      onPickTargetComplete();
      return;
    }

    if (tool === 'hand') {
      try {
        await navigateTo(node);
      } catch (error) {
        console.error('Failed to navigate:', error);
      }
      return;
    }

    if (tool !== 'select') return;

    if (editorActive) {
      onSelectedNodeIdsChange(new Set([node.id]));
      return;
    }

    onClearSelection();
    try {
      await navigateTo(node);
    } catch (error) {
      console.error('Failed to navigate:', error);
    }
  }, [editorActive, onClearSelection, onPickTargetComplete, onSelectedNodeIdsChange, pickTarget, tool]);

  const handleNodePointerDown = useCallback((node: NavigationNode, info: PointerInfo) => {
    if (info.button !== 0) return;
    if (info.shiftKey) return;
    if (info.altKey) return;
    if (info.metaKey || info.ctrlKey) return;
    if (layoutOptions.mode === 'radial' && node.isRoot?.()) return;
    const dragCandidates: NavigationNode[] = [];
    if (tree && selectedNodeIds.size > 1 && selectedNodeIds.has(node.id)) {
      selectedNodeIds.forEach((id) => {
        const candidate = tree.findNodeById(id);
        if (!candidate) return;
        let parent = candidate.getParent?.();
        let hasSelectedAncestor = false;
        while (parent) {
          if (selectedNodeIds.has(parent.id)) {
            hasSelectedAncestor = true;
            break;
          }
          parent = parent.getParent?.();
        }
        if (!hasSelectedAncestor) dragCandidates.push(candidate);
      });
    } else {
      dragCandidates.push(node);
    }
    const dragNodes =
      layoutOptions.mode === 'radial'
        ? dragCandidates.filter((candidate) => !candidate.isRoot?.())
        : dragCandidates;
    if (dragNodes.length === 0) return;
    const nodes: DragNodeState[] = [];
    let rootCenterX = 0;
    let rootCenterY = 0;
    if (layoutOptions.mode === 'radial') {
      if (!root) return;
      const rootPos = basePositions.get(root.id);
      if (!rootPos) return;
      rootCenterX = rootPos.x + nodeWidth / 2;
      rootCenterY = rootPos.y + nodeHeight / 2;
    }
    for (const dragNode of dragNodes) {
      const startPos = positions.get(dragNode.id);
      if (!startPos) continue;
      const startLayout = dragNode.data.layout;
      const baseOffsetX = typeof startLayout?.offsetX === 'number' ? startLayout.offsetX : 0;
      const baseOffsetY = typeof startLayout?.offsetY === 'number' ? startLayout.offsetY : 0;
      const entry: DragNodeState = {
        nodeId: dragNode.id,
        startNodeX: startPos.x,
        startNodeY: startPos.y,
        baseOffsetX,
        baseOffsetY,
      };
      if (layoutOptions.mode === 'radial') {
        const basePos = basePositions.get(dragNode.id);
        if (!basePos) continue;
        const baseCenterX = basePos.x + nodeWidth / 2;
        const baseCenterY = basePos.y + nodeHeight / 2;
        const baseDx = baseCenterX - rootCenterX;
        const baseDy = baseCenterY - rootCenterY;
        const baseAngle = Math.atan2(baseDy, baseDx);
        const baseRadius = Math.hypot(baseDx, baseDy);
        let ancestorAngle = 0;
        let ancestorRadius = 0;
        let parent = dragNode.getParent?.();
        while (parent) {
          const radial = parent.data.layout?.radial;
          ancestorAngle += radial?.angleDelta ?? 0;
          ancestorRadius += radial?.radiusDelta ?? 0;
          parent = parent.getParent?.();
        }
        entry.radial = {
          rootCenterX,
          rootCenterY,
          baseAngle,
          baseRadius,
          ancestorAngle,
          ancestorRadius,
          minRadius: nodeWidth * 0.35,
        };
      }
      nodes.push(entry);
    }
    if (nodes.length === 0) return;
    dragMovedRef.current = false;
    dragStateRef.current = {
      startX: info.clientX,
      startY: info.clientY,
      mode: layoutOptions.mode,
      nodes,
      latestLayouts: new Map(),
    };

    // Initialise reparent preview for single-node editor drags
    if (editorActive && nodes.length === 1) {
      const draggedNode = tree?.findNodeById(nodes[0]!.nodeId);
      const originalParent = draggedNode?.getParent?.();
      if (draggedNode && originalParent) {
        dragReparentRef.current = {
          draggedId: draggedNode.id,
          originalParentId: originalParent.id,
          targetId: null,
          subtreeIds: collectSubtreeIds(draggedNode),
        };
      }
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
        suppressClickRef.current = true;
      }
      if (!dragMovedRef.current) return;
      if (state.mode === 'radial') {
        const layouts: LayoutUpdateMap = new Map();
        state.nodes.forEach((entry) => {
          if (!entry.radial) return;
          const targetCenterX = entry.startNodeX + deltaX + nodeWidth / 2;
          const targetCenterY = entry.startNodeY + deltaY + nodeHeight / 2;
          const desiredDx = targetCenterX - entry.radial.rootCenterX;
          const desiredDy = targetCenterY - entry.radial.rootCenterY;
          const desiredAngle = Math.atan2(desiredDy, desiredDx);
          const desiredRadius = Math.max(entry.radial.minRadius, Math.hypot(desiredDx, desiredDy));
          const totalAngleDelta = desiredAngle - entry.radial.baseAngle;
          const totalRadiusDelta = desiredRadius - entry.radial.baseRadius;
          const nodeAngleDelta = totalAngleDelta - entry.radial.ancestorAngle;
          const nodeRadiusDelta = totalRadiusDelta - entry.radial.ancestorRadius;
          layouts.set(entry.nodeId, { radial: { angleDelta: nodeAngleDelta, radiusDelta: nodeRadiusDelta } });
        });
        state.latestLayouts = layouts;
        if (layouts.size > 0) {
          setDragPreview(layouts);
          queueLayoutUpdates(layouts);
        }
      } else {
        const layouts: LayoutUpdateMap = new Map();
        state.nodes.forEach((entry) => {
          const offsetX = entry.baseOffsetX + deltaX;
          const offsetY = entry.baseOffsetY + deltaY;
          layouts.set(entry.nodeId, { offsetX, offsetY });
        });
        state.latestLayouts = layouts;
        if (layouts.size > 0) {
          setDragPreview(layouts);
          queueLayoutUpdates(layouts);
        }
      }

      // --- Snap-to-parent proximity detection (editor mode) ---
      const rp = dragReparentRef.current;
      if (rp) {
        const entry = state.nodes[0]!;
        const dragCenterX = entry.startNodeX + deltaX + nodeWidth / 2;
        const dragCenterY = entry.startNodeY + deltaY + nodeHeight / 2;
        let bestId: NodeId | null = null;
        let bestDist = SNAP_RADIUS;
        positionsRef.current.forEach((pos, id) => {
          if (rp.subtreeIds.has(id)) return; // skip self & descendants
          const cx = pos.x + nodeWidth / 2;
          const cy = pos.y + nodeHeight / 2;
          const dist = Math.hypot(dragCenterX - cx, dragCenterY - cy);
          if (dist < bestDist) {
            bestDist = dist;
            bestId = id;
          }
        });
        if (rp.targetId !== bestId) {
          rp.targetId = bestId;
          setDragReparentTarget({
            draggedId: rp.draggedId,
            originalParentId: rp.originalParentId,
            targetId: bestId,
          });
        }
      }
    };

    const handleUp = async (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      const state = dragStateRef.current;
      const didDrag = dragMovedRef.current;
      dragStateRef.current = null;
      setIsDraggingNode(false);
      if (didDrag) {
        nodeDragJustEndedRef.current = true;
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
      if (!state) {
        dragMovedRef.current = false;
        setDragPreview(null);
        dragReparentRef.current = null;
        setDragReparentTarget(null);
        return;
      }
      if (!didDrag) {
        setDragPreview(null);
        dragReparentRef.current = null;
        setDragReparentTarget(null);
        return;
      }

      // Editor mode: use snap-based reparent preview
      const rp = dragReparentRef.current;
      dragReparentRef.current = null;
      setDragReparentTarget(null);

      if (rp) {
        // Cancel any pending throttled layout updates
        const sendState = layoutSendRef.current;
        if (sendState.timer !== null) {
          window.clearTimeout(sendState.timer);
          sendState.timer = null;
        }
        sendState.pending = null;

        if (rp.targetId) {
          // Drop onto snap target → reparent
          setDragPreview(null);
          dragMovedRef.current = false;

          // Clear stale layout offsets on the local tree
          if (tree) {
            const clearLayout = (n: NavigationNode) => {
              if (n.data.layout) {
                const { layout: _, ...rest } = n.data;
                n.data = rest as typeof n.data;
              }
              for (const child of n.getChildren()) clearLayout(child);
            };
            const draggedNode = tree.findNodeById(rp.draggedId);
            if (draggedNode) clearLayout(draggedNode);
          }

          try {
            await reparentNode(rp.draggedId, rp.targetId);
          } catch (error) {
            console.error('Reparent failed:', error);
          }
          return;
        } else {
          // No snap target → cancel drag, snap back to original position
          setDragPreview(null);
          dragMovedRef.current = false;
          return;
        }
      }

      const latestLayouts = state.latestLayouts;
      if (latestLayouts.size > 0) {
        const sendState = layoutSendRef.current;
        if (sendState.timer !== null) {
          window.clearTimeout(sendState.timer);
          sendState.timer = null;
        }
        sendState.pending = null;
        sendState.lastSent = performance.now();
        await flushLayoutUpdates(latestLayouts);

        // Apply the flushed layout values directly to the sidepanel tree's
        // node data so positions stay correct when dragPreview is cleared.
        // SET_NODE_LAYOUT only updates the background tree silently; without
        // this the sidepanel tree retains stale offsets and nodes snap back.
        if (tree) {
          latestLayouts.forEach((layout, nodeId) => {
            const treeNode = tree.findNodeById(nodeId);
            if (!treeNode) return;
            const prev = treeNode.data.layout;
            const prevOffsetX = prev?.offsetX ?? 0;
            const prevOffsetY = prev?.offsetY ?? 0;
            treeNode.data = {
              ...treeNode.data,
              layout: {
                offsetX: typeof layout.offsetX === 'number' ? layout.offsetX : prevOffsetX,
                offsetY: typeof layout.offsetY === 'number' ? layout.offsetY : prevOffsetY,
                ...(layout.radial
                  ? { radial: layout.radial }
                  : prev?.radial
                    ? { radial: prev.radial }
                    : {}),
              },
            };
          });
        }

      }
      setDragPreview(null);
      dragMovedRef.current = false;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp, { once: true });
    window.addEventListener('pointercancel', handleUp, { once: true });
  }, [basePositions, editorActive, flushLayoutUpdates, layoutOptions.mode, nodeHeight, nodeWidth, positions, queueLayoutUpdates, root, tree]);

  const handleNodeContextMenu = useCallback(
    (node: NavigationNode, clientX: number, clientY: number) => {
      if (selectedNodeIds.size > 0) {
        onOpenContextMenu({
          type: 'bulk',
          nodeIds: Array.from(selectedNodeIds),
          position: { x: clientX, y: clientY },
        });
        return;
      }
      onOpenContextMenu({
        type: 'node',
        nodeId: node.id,
        position: { x: clientX, y: clientY },
      });
    },
    [onOpenContextMenu, selectedNodeIds],
  );

  const handleWrapperContextMenu = (clientX: number, clientY: number) => {
    if (selectedNodeIds.size === 0) return;
    onOpenContextMenu({
      type: 'bulk',
      nodeIds: Array.from(selectedNodeIds),
      position: { x: clientX, y: clientY },
    });
  };


  const renderNodes = useMemo<NodeRenderModel[]>(() => {
    const dimmedBySearch = searchActive;
    return visibleDisplayNodes.map((pos) => {
      const id = pos.node.id;
      const override = animatedPositionsRef.current.get(id);
      const x = override?.x ?? pos.x;
      const y = override?.y ?? pos.y;
      const tabState = tabStates[id];
      const isOpen = openNodeIds.has(id);
      const isSearchMatch = searchSet.has(id);
      return {
        id,
        node: pos.node,
        x,
        y,
        width: nodeWidth,
        height: nodeHeight,
        isCurrent: currentNodeId === id,
        isOpen,
        openProgress: display.dimClosedNodes
          ? openProgressRef.current.get(id) ?? (isOpen ? 1 : 0)
          : 1,
        tabCount: nodeTabCounts[id] ?? 0,
        ...(tabState !== undefined ? { tabState } : {}),
        isCollapsed: collapsedNodeIds.has(id),
        isSelected: false,
        isPreview: false,
        isSearchMatch,
        isSearchFocused: focusedSearchId === id,
        isSearchDimmed: dimmedBySearch && !isSearchMatch,
        isHoverFocused: hoverNodeId === id,
        display,
        tagDefs,
      };
    });
  }, [
    animationVersion,
    currentNodeId,
    collapsedNodeIds,
    display,
    focusedSearchId,
    hoverNodeId,
    nodeHeight,
    nodeTabCounts,
    nodeWidth,
    openNodeIds,
    searchActive,
    searchSet,
    tabStates,
    tagDefs,
    visibleDisplayNodes,
  ]);

  const particleRenderModels = useMemo<ParticleRenderModel[]>(() => {
    return particleAnimationsRef.current.map((particle) => {
      const progress = Math.min(1, particle.age / particle.life);
      const eased = easeOutCubic(progress);
      const alpha = Math.max(0, 1 - progress);
      return {
        id: particle.id,
        x: lerp(particle.startX, particle.endX, eased),
        y: lerp(particle.startY, particle.endY, eased),
        radius: particle.radius,
        alpha,
      };
    });
  }, [particleVersion]);
  const pathNodeIds = useMemo(() => {
    if (!root || currentNodeId === null) return null;
    return getPathToNode(root, currentNodeId);
  }, [currentNodeId, root]);
  const connectionPositions = useMemo(() => {
    if (animatedPositionsRef.current.size === 0 && pendingEnterIds.size === 0) return positions;
    const next = new Map<NodeId, NodePosition>();
    positions.forEach((pos, id) => {
      if (pendingEnterIds.has(id)) return;
      const override = animatedPositionsRef.current.get(id);
      if (override) {
        next.set(id, { ...pos, x: override.x, y: override.y });
      } else {
        next.set(id, pos);
      }
    });
    return next;
  }, [animationVersion, pendingEnterIds, positions]);

  const baseConnections = useMemo(
    () =>
      effectiveShowConnections
        ? buildConnections(
            root,
            connectionPositions,
            pathNodeIds,
            layoutOptions.mode,
            hideTreeRoot,
            nodeWidth,
            nodeHeight,
          )
        : [],
    [
      effectiveShowConnections,
      hideTreeRoot,
      layoutOptions.mode,
      nodeHeight,
      nodeWidth,
      pathNodeIds,
      connectionPositions,
      root,
    ],
  );

  // During an editor drag-reparent preview, hide the old parent→dragged
  // connection and show a preview connection from the snap target.
  const connections = useMemo(() => {
    if (!dragReparentTarget) return baseConnections;
    const { draggedId, originalParentId, targetId } = dragReparentTarget;
    const excludeKey = `${originalParentId}-${draggedId}`;
    const filtered = baseConnections.filter((c) => c.id !== excludeKey);
    if (targetId) {
      const parentPos = connectionPositions.get(targetId);
      const childPos = connectionPositions.get(draggedId);
      if (parentPos && childPos) {
        let startX: number, startY: number, endX: number, endY: number;
        if (layoutOptions.mode === 'tree') {
          startX = parentPos.x + nodeWidth / 2;
          startY = parentPos.y + nodeHeight;
          endX = childPos.x + nodeWidth / 2;
          endY = childPos.y;
        } else if (layoutOptions.mode === 'mindmap') {
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
        let cp1: { x: number; y: number };
        let cp2: { x: number; y: number };
        if (layoutOptions.mode === 'tree') {
          cp1 = { x: startX, y: midY };
          cp2 = { x: endX, y: midY };
        } else if (layoutOptions.mode === 'mindmap') {
          cp1 = { x: midX, y: startY };
          cp2 = { x: midX, y: endY };
        } else {
          cp1 = { x: midX, y: startY };
          cp2 = { x: midX, y: endY };
        }
        filtered.push({
          id: `preview-${targetId}-${draggedId}`,
          start: { x: startX, y: startY },
          cp1,
          cp2,
          end: { x: endX, y: endY },
          onPath: true, // highlight style for preview
          bounds: {
            minX: Math.min(startX, endX, cp1.x, cp2.x),
            minY: Math.min(startY, endY, cp1.y, cp2.y),
            maxX: Math.max(startX, endX, cp1.x, cp2.x),
            maxY: Math.max(startY, endY, cp1.y, cp2.y),
          },
        });
      }
    }
    return filtered;
  }, [baseConnections, connectionPositions, dragReparentTarget, layoutOptions.mode, nodeHeight, nodeWidth]);

  useEffect(() => {
    rendererRef.current?.setData({
      nodes: renderNodes,
      connections,
      layoutMode: layoutOptions.mode,
      nodeWidth,
      nodeHeight,
      showConnections: effectiveShowConnections,
      particles: particleRenderModels,
    });
  }, [
    connections,
    effectiveShowConnections,
    layoutOptions.mode,
    nodeHeight,
    nodeWidth,
    particleRenderModels,
    particleVersion,
    renderNodes,
  ]);

  useEffect(() => {
    rendererRef.current?.setDetailMode(detailMode);
  }, [detailMode]);

  useEffect(() => {
    rendererRef.current?.setConnectionQuality(connectionQuality);
  }, [connectionQuality]);

  useEffect(() => {
    rendererRef.current?.setMetricsListener(onRenderMetrics);
  }, [onRenderMetrics]);

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
    if (animate) {
      animateViewTo(fitView, 300);
    } else {
      cancelViewAnimation();
      viewRef.current = fitView;
      onGraphViewChange(fitView);
      rendererRef.current?.setView(fitView);
      applyGridTransform(fitView);
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
    if (animate) {
      animateViewTo(nextView, 300);
    } else {
      cancelViewAnimation();
      viewRef.current = nextView;
      onGraphViewChange(nextView);
      rendererRef.current?.setView(nextView);
      applyGridTransform(nextView);
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

  const computeZoomView = useCallback(
    (pointerX: number, pointerY: number, scaleFactor: number): ViewState | null => {
      const { translateX, translateY, scale } = viewRef.current;
      const fitView = getFitToViewView();
      const minScale = Math.min(0.15, fitView?.scale ?? 0.15);
      const nextScale = Math.min(3, Math.max(minScale, scale * scaleFactor));
      if (nextScale === scale) return null;
      const canvasX = (pointerX - translateX) / scale;
      const canvasY = (pointerY - translateY) / scale;
      const nextTranslateX = pointerX - canvasX * nextScale;
      const nextTranslateY = pointerY - canvasY * nextScale;
      return { translateX: nextTranslateX, translateY: nextTranslateY, scale: nextScale };
    },
    [getFitToViewView],
  );

  const zoomAt = useCallback(
    (pointerX: number, pointerY: number, scaleFactor: number, animate = false) => {
      const nextView = computeZoomView(pointerX, pointerY, scaleFactor);
      if (!nextView) return;
      if (animate) {
        animateViewTo(nextView, 180);
      } else {
        viewRef.current = nextView;
        scheduleGraphView(nextView);
      }
    },
    [animateViewTo, computeZoomView, scheduleGraphView],
  );

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
      animateViewTo(nextView, 300);
    } else {
      cancelViewAnimation();
      viewRef.current = nextView;
      onGraphViewChange(nextView);
      rendererRef.current?.setView(nextView);
      applyGridTransform(nextView);
    }
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
    zoomAt(pointerX, pointerY, scaleFactor, animate);
  };

  const finalizeSelection = () => {
    if (!isSelectingRef.current) return;
    cancelSelectionCompute();
    if (selectionDragRef.current && selectionWorldRectRef.current) {
      const renderer = rendererRef.current;
      const rect = selectionWorldRectRef.current;
      if (renderer && rect) {
        const hits = renderer.queryNodesInWorldRect(rect);
        const preview = buildPreviewSelection(
          baseSelectionRef.current,
          hits,
          selectionModeRef.current,
          positionsRef.current,
        );
        previewSelectionRef.current = preview;
      }
    }
    isSelectingRef.current = false;
    const finalSelection = new Set(previewSelectionRef.current);
    const renderer = rendererRef.current;
    renderer?.clearSelectionPreview();
    renderer?.setSelectedNodeIds(finalSelection);
    onSelectedNodeIdsChange(finalSelection);
    hideSelectionBox();
    previewSelectionRef.current = new Set();
    selectionWorldRectRef.current = null;
  };

  const clearSelectionState = useCallback(() => {
    cancelSelectionCompute();
    isSelectingRef.current = false;
    selectionDragRef.current = false;
    previewSelectionRef.current = new Set();
    selectionWorldRectRef.current = null;
    rendererRef.current?.clearSelectionPreview();
    rendererRef.current?.setSelectedNodeIds(new Set());
    onClearSelection();
    hideSelectionBox();
  }, [cancelSelectionCompute, hideSelectionBox, onClearSelection]);

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

  const getPointerNodeId = (
    event: ReactPointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>,
  ) => {
    const wrapper = wrapperRef.current;
    const renderer = rendererRef.current;
    if (!wrapper || !renderer) return null;
    const rect = wrapper.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    return renderer.hitTestScreen(pointerX, pointerY);
  };

  const getPointerTarget = (
    event: ReactPointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>,
  ): PointerHitTarget | null => {
    const wrapper = wrapperRef.current;
    const renderer = rendererRef.current;
    if (!wrapper || !renderer) return null;
    const rect = wrapper.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    return renderer.hitTestTargetScreen(pointerX, pointerY);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (isGraphUiTarget(target)) return;
    if (!wrapperRef.current) return;
    cancelViewAnimation();
    suppressClickRef.current = false;
    nodeDragJustEndedRef.current = false;
    selectionDragRef.current = false;
    pointerDownNodeIdRef.current = null;
    pointerDownTargetRef.current = null;
    const rect = wrapperRef.current.getBoundingClientRect();
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const hitTarget = getPointerTarget(event);
    pointerDownTargetRef.current = hitTarget;
    const hitNodeId = hitTarget?.nodeId ?? null;
    pointerDownNodeIdRef.current = hitTarget?.target === 'node' ? hitNodeId : null;
    if (hitTarget?.target === 'collapse-icon') {
      return;
    }
    if (hitNodeId && tree) {
      const node = tree.findNodeById(hitNodeId);
      if (node) {
        handleNodePointerDown(node, event);
        return;
      }
    }

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
      cancelSelectionCompute();
      selectionWorldRectRef.current = null;
      rendererRef.current?.clearSelectionPreview();
      const selectionMode = event.altKey ? 'remove' : event.shiftKey ? 'add' : 'replace';
      selectionModeRef.current = selectionMode;
      if (selectionMode === 'replace') {
        clearSelectionState();
      }
      isSelectingRef.current = true;
      const startX = event.clientX - rect.left;
      const startY = event.clientY - rect.top;
      selectionStartRef.current = { x: startX, y: startY };
      baseSelectionRef.current =
        selectionMode === 'replace' ? new Set() : new Set(selectedNodeIds);
      updateSelectionBox({ left: startX, top: startY, width: 0, height: 0 });
      previewSelectionRef.current = new Set(baseSelectionRef.current);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!wrapperRef.current) return;
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== event.pointerId) {
      return;
    }
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
      updateSelectionBox({ left, top, width, height });
      if (!selectionDragRef.current && (width > 3 || height > 3)) {
        selectionDragRef.current = true;
        suppressClickRef.current = true;
      }
      if (!selectionDragRef.current) return;
      const { translateX, translateY, scale } = viewRef.current;
      selectionWorldRectRef.current = {
        minX: (left - translateX) / scale,
        minY: (top - translateY) / scale,
        maxX: (left + width - translateX) / scale,
        maxY: (top + height - translateY) / scale,
      };
      scheduleSelectionPreview();
      return;
    }
    if (dragStateRef.current) return;

    const target = event.target as HTMLElement;
    if (isGraphUiTarget(target)) return;
    const hitNodeId = getPointerNodeId(event);
    if (hitNodeId !== lastHoverNodeIdRef.current) {
      lastHoverNodeIdRef.current = hitNodeId;
      onSetHoverNodeId(hitNodeId);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== event.pointerId) {
      return;
    }
    releasePointerCapture(event.currentTarget, activePointerIdRef.current);
    activePointerIdRef.current = null;
    const downTarget = pointerDownTargetRef.current;
    pointerDownTargetRef.current = null;
    if (downTarget?.target === 'collapse-icon') {
      const hitTarget = getPointerTarget(event);
      if (hitTarget?.target === 'collapse-icon' && hitTarget.nodeId === downTarget.nodeId) {
        onExpandNodes([hitTarget.nodeId]);
      }
      return;
    }
    if (pointerDownNodeIdRef.current) {
      const nodeId = pointerDownNodeIdRef.current;
      pointerDownNodeIdRef.current = null;
      if (nodeDragJustEndedRef.current) {
        nodeDragJustEndedRef.current = false;
        dragMovedRef.current = false;
        return;
      }
      // If a node drag is still in progress (handleUp on window hasn't
      // processed the drag end yet), defer cleanup to handleUp so it can
      // read dragMovedRef correctly and run the full layout-commit path.
      if (dragStateRef.current && dragMovedRef.current) {
        return;
      }
      if (!dragMovedRef.current) {
        const node = tree?.findNodeById(nodeId);
        if (node) {
          handleNodeClick(node);
          suppressClickRef.current = true;
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
        }
      } else {
        dragMovedRef.current = false;
      }
      return;
    }
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

    if (!isPanningRef.current && !isSelectingRef.current) {
      const nodeId = pointerDownNodeIdRef.current;
      pointerDownNodeIdRef.current = null;
      const wasDraggingNode = dragStateRef.current !== null || dragMovedRef.current || isDraggingNode;
      if (wasDraggingNode) {
        return;
      }
      if (nodeId && tree) {
        const node = tree.findNodeById(nodeId);
        if (node) {
          suppressClickRef.current = true;
          handleNodeClick(node);
        }
      }
    } else {
      pointerDownNodeIdRef.current = null;
    }
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== event.pointerId) {
      return;
    }
    releasePointerCapture(event.currentTarget, activePointerIdRef.current);
    activePointerIdRef.current = null;
    nodeDragJustEndedRef.current = false;
    pointerDownNodeIdRef.current = null;
    pointerDownTargetRef.current = null;
    dragMovedRef.current = false;
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
    pointerDownNodeIdRef.current = null;
  };

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    cancelViewAnimation();
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
  }, [cancelViewAnimation, scheduleGraphView, zoomAt]);

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
    const code = event.code;
    if (code === 'Equal' || code === 'NumpadAdd') {
      event.preventDefault();
      zoom('in', true);
    } else if (code === 'Minus' || code === 'NumpadSubtract') {
      event.preventDefault();
      zoom('out', true);
    } else if (code === 'Digit0' || code === 'Numpad0') {
      event.preventDefault();
      zoom('reset', true);
    } else if (code === 'KeyH') {
      event.preventDefault();
      onGraphToolChange('hand');
      clearSelectionState();
    } else if (code === 'KeyV') {
      event.preventDefault();
      onGraphToolChange('select');
      clearSelectionState();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (pickTarget) {
        onPickTargetComplete();
        return;
      }
      clearSelectionState();
    }
  };



  const handleBackgroundClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (isGraphUiTarget(target)) return;
    if (getPointerNodeId(event)) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (pickTarget) {
      onPickTargetComplete();
      return;
    }
    clearSelectionState();
  };

  return (
    <div className="stack-container" id="stackContainer">
      <div
        className={`graph-wrapper${isDraggingNode ? ' is-dragging' : ''}`}
        ref={wrapperRef}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={() => {
          lastHoverNodeIdRef.current = null;
          onSetHoverNodeId(null);
        }}
        onKeyDown={handleKeyDown}
        onContextMenu={(event) => {
          event.preventDefault();
          const target = event.target as HTMLElement;
          if (isGraphUiTarget(target)) return;
          const nodeId = getPointerNodeId(event);
          if (nodeId && tree) {
            const node = tree.findNodeById(nodeId);
            if (node) {
              handleNodeContextMenu(node, event.clientX, event.clientY);
              return;
            }
          }
          handleWrapperContextMenu(event.clientX, event.clientY);
        }}
        onClick={handleBackgroundClick}
        style={{
          cursor: pickTarget
            ? 'crosshair'
            : tool === 'hand'
              ? isPanning
                ? 'grabbing'
                : 'grab'
              : hoverNodeId
                ? 'pointer'
                : 'default',
        }}
      >
        <div className="graph-canvas" ref={pixiHostRef} />
        <div
          ref={selectionBoxRef}
          className="graph-selection-box"
          style={{ opacity: 0, width: '0px', height: '0px' }}
        />
        <GraphZoomControls
          tool={tool}
          onToolChange={(nextTool) => {
            onGraphToolChange(nextTool);
            clearSelectionState();
          }}
          onZoom={(direction) => zoom(direction, true)}
          fullViewEnabled={fullViewEnabled}
          onOpenFullView={async () => {
            try {
              const fullViewUrl = chrome.runtime.getURL('fullview.html');
              const existing = await chrome.tabs.query({ url: fullViewUrl });
              const tab = existing.find((t) => t.active) ?? existing[0];
              if (tab?.id != null) {
                if (tab.windowId != null) {
                  await chrome.windows.update(tab.windowId, { focused: true });
                }
                await chrome.tabs.update(tab.id, { active: true });
                await chrome.tabs.reload(tab.id);
              } else {
                await chrome.tabs.create({ url: fullViewUrl, active: true });
              }
            } catch (error) {
              console.error('Failed to open full view:', error);
            }
          }}
        />
        {pickTarget && (
          <div className="graph-pick-hint" data-graph-ui="true">
            <span>Click a node to duplicate to</span>
            <button type="button" onClick={onPickTargetComplete}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
