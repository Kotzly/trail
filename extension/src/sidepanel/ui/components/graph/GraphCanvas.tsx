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
import GraphZoomControls from './GraphZoomControls.js';
import { buildConnections, getPathBetweenNodes, getPathToNode } from './graph-utils.js';
import { GraphPixiRenderer } from '../../graph/render/GraphPixiRenderer.js';
import type { NodeRenderModel, ParticleRenderModel } from '../../graph/render/types.js';
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

type GraphCanvasProps = {
  tree: NavigationTree | null;
  treeUpdate: { reason: TreeUpdatedInput['reason']; at: number } | null;
  currentNodeId: NodeId | null;
  openNodeIds: Set<NodeId>;
  nodeTabCounts: Record<NodeId, number>;
  tabStates: Record<NodeId, TabState>;
  search: SearchState;
  settings: Settings | null;
  showConnections: boolean;
  detailMode: 'full' | 'low' | 'dot';
  graphView: ViewState;
  tool: GraphTool;
  selectedNodeIds: Set<NodeId>;
  hoverNodeId: NodeId | null;
  resetVersion: number;
  viewIntent: TreeUpdatedInput['view'] | null;
  tagDefs: Record<string, TagDefinition>;
  onGraphToolChange: (tool: GraphTool) => void;
  onSelectedNodeIdsChange: (ids: Set<NodeId>) => void;
  onToggleSelectedNode: (id: NodeId) => void;
  onClearSelection: () => void;
  onGraphViewChange: (view: Partial<ViewState>) => void;
  onSetHoverNodeId: (nodeId: NodeId | null) => void;
  onOpenContextMenu: (menu: ContextMenuState) => void;
  onClearViewIntent: () => void;
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
  metaKey: boolean;
  ctrlKey: boolean;
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

export default function GraphCanvas({
  tree,
  treeUpdate,
  currentNodeId,
  openNodeIds,
  nodeTabCounts,
  tabStates,
  search,
  settings,
  showConnections,
  detailMode,
  graphView,
  tool,
  selectedNodeIds,
  hoverNodeId,
  resetVersion,
  viewIntent,
  tagDefs,
  onGraphToolChange,
  onSelectedNodeIdsChange,
  onToggleSelectedNode,
  onClearSelection,
  onGraphViewChange,
  onSetHoverNodeId,
  onOpenContextMenu,
  onClearViewIntent,
}: GraphCanvasProps) {
  const searchActive = search.active;
  const searchNavStep = search.navStep;
  const effectiveShowConnections = showConnections && detailMode === 'full';

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const pixiHostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<GraphPixiRenderer | null>(null);
  const viewAnimationRef = useRef<number | null>(null);
  const viewRef = useRef(graphView);
  const didInitView = useRef(false);
  const pendingViewRef = useRef<Partial<ViewState> | null>(null);
  const viewRafRef = useRef<number | null>(null);
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
  const animationDuration = 150;
  const animationStagger = Math.round(animationDuration * 0.3);
  const openAnimationDuration = 240;
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
  const animateTick = useCallback(
    function animateTick(time: number) {
      const deltaTime = lastAnimationTimeRef.current === null ? 16 : time - lastAnimationTimeRef.current;
      lastAnimationTimeRef.current = time;
      animationNowRef.current = time;
      const states = animationStatesRef.current;
      const entries = Array.from(states.entries());
      let nodesDirty = false;
      entries.forEach(([id, state]) => {
        const elapsed = time - state.startTime;
        if (elapsed < 0) {
          nodesDirty = true;
          return;
        }
        const progress = Math.min(1, elapsed / state.duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const x = state.startX + (state.endX - state.startX) * eased;
        const y = state.startY + (state.endY - state.startY) * eased;
        animatedPositionsRef.current.set(id, { x, y });
        nodesDirty = true;
        if (progress >= 1) {
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
          const elapsed = time - state.startTime;
          if (elapsed < 0) {
            openDirty = true;
            return;
          }
          const progress = Math.min(1, elapsed / state.duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          const value = state.from + (state.to - state.from) * eased;
          openProgressRef.current.set(id, value);
          openDirty = true;
          if (progress >= 1) {
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

  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [previewSelection, setPreviewSelection] = useState<Set<NodeId>>(new Set());
  const previewSelectionRef = useRef<Set<NodeId>>(new Set());
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [dragPreview, setDragPreview] = useState<LayoutUpdateMap | null>(null);
  const layoutSendRef = useRef<{
    lastSent: number;
    timer: number | null;
    pending: LayoutUpdateMap | null;
  }>({ lastSent: 0, timer: null, pending: null });
  const isPanningRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const selectionAnchorRef = useRef<NodeId | null>(null);
  const pointerDownNodeIdRef = useRef<NodeId | null>(null);
  const pointerDownInfoRef = useRef<PointerInfo | null>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    mode: LayoutMode;
    nodes: DragNodeState[];
    latestLayouts: LayoutUpdateMap;
  } | null>(null);
  const dragMovedRef = useRef(false);
  const nodeDragJustEndedRef = useRef(false);
  const isSelectingRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panPointerStartRef = useRef({ x: 0, y: 0 });
  const panMovedRef = useRef(false);
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const baseSelectionRef = useRef<Set<NodeId>>(new Set());
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
        }
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

  useEffect(() => {
    viewRef.current = graphView;
    rendererRef.current?.setView(graphView);
  }, [graphView]);

  useEffect(() => {
    const host = pixiHostRef.current;
    if (!host) return;
    const renderer = new GraphPixiRenderer(host);
    rendererRef.current = renderer;
    renderer.setView(viewRef.current);
    renderer.setDetailMode(detailMode);
    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const resizeObserver = new ResizeObserver(() => {
      rendererRef.current?.setView(viewRef.current);
    });
    resizeObserver.observe(wrapper);
    return () => resizeObserver.disconnect();
  }, []);

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
      for (const [nodeId, layout] of updates) {
        await setNodeLayout(nodeId, layout);
      }
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
        const elapsed = time - start;
        const t = Math.min(1, elapsed / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        const next: ViewState = {
          translateX: from.translateX + (target.translateX - from.translateX) * eased,
          translateY: from.translateY + (target.translateY - from.translateY) * eased,
          scale: from.scale + (target.scale - from.scale) * eased,
        };
        viewRef.current = next;
        onGraphViewChange(next);
        rendererRef.current?.setView(next);
        if (t < 1) {
          viewAnimationRef.current = window.requestAnimationFrame(animate);
        } else {
          viewAnimationRef.current = null;
        }
      };
      viewAnimationRef.current = window.requestAnimationFrame(animate);
    },
    [cancelViewAnimation, onGraphViewChange],
  );

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

  const startEnter = useCallback(
    (pos: NodePosition, startCenter: { x: number; y: number }, delayMs = 0) => {
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
        duration: animationDuration,
      };
      animationStatesRef.current.set(id, state);
      animatedPositionsRef.current.set(id, { x: startX, y: startY });
      invalidateAnimation();
      startAnimationLoop();
    },
    [animationDuration, invalidateAnimation, nodeHeight, nodeWidth, startAnimationLoop],
  );

  const startExit = useCallback(
    (
      pos: NodePosition,
      endCenter: { x: number; y: number },
      delayMs = 0,
      durationMs = animationDuration,
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
      animationStatesRef.current.set(id, state);
      animatedPositionsRef.current.set(id, { x: startX, y: startY });
      exitNodesRef.current.set(id, { ...pos });
      invalidateAnimation();
      startAnimationLoop();
      const existingTimeout = exitParticleTimeoutsRef.current.get(id);
      if (existingTimeout !== undefined) {
        window.clearTimeout(existingTimeout);
        exitParticleTimeoutsRef.current.delete(id);
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
    [animationDuration, invalidateAnimation, nodeHeight, nodeWidth, spawnExitParticles, startAnimationLoop],
  );

  const startMove = useCallback(
    (id: NodeId, fromX: number, fromY: number, toX: number, toY: number) => {
      animationStatesRef.current.delete(id);
      const state: NodeAnimationState = {
        id,
        type: 'move',
        startX: fromX,
        startY: fromY,
        endX: toX,
        endY: toY,
        startTime: performance.now(),
        duration: animationDuration,
      };
      animationStatesRef.current.set(id, state);
      animatedPositionsRef.current.set(id, { x: fromX, y: fromY });
      invalidateAnimation();
      startAnimationLoop();
    },
    [animationDuration, invalidateAnimation, startAnimationLoop],
  );

  useLayoutEffect(() => {
    const prev = prevPositionsRef.current;
    const current = new Map(positions);
    if (prev.size === 0) {
      prevPositionsRef.current = current;
      return;
    }
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
        const parent = pos.node.getParent?.();
        const parentPos = parent ? current.get(parent.id) : undefined;
        const startCenter = parentPos
          ? { x: parentPos.x + nodeWidth / 2, y: parentPos.y + nodeHeight / 2 }
          : currentRootCenter;
        const depth = getEnterDepth(pos.node);
        startEnter(pos, startCenter, depth * animationStagger);
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
  }, [
    animationDuration,
    animationStagger,
    dragPreview,
    isDraggingNode,
    nodeHeight,
    nodeWidth,
    positions,
    root,
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

  const activeNodes = useMemo(() => {
    const list = Array.from(positions.values());
    if (layoutOptions.mode !== 'tree' || !root || !hideTreeRoot) return list;
    return list.filter((pos) => pos.node.id !== root.id);
  }, [hideTreeRoot, layoutOptions.mode, positions, root]);

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
    const filtered = displayNodes.filter((pos) => !pendingEnterIds.has(pos.node.id));
    if (layoutOptions.mode !== 'tree' || !root || !hideTreeRoot) return filtered;
    return filtered.filter((pos) => pos.node.id !== root.id);
  }, [displayNodes, hideTreeRoot, layoutOptions.mode, pendingEnterIds, root]);
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

  const handleNodeClick = useCallback(async (node: NavigationNode, info: PointerInfo) => {
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
    const isMeta = info.metaKey || info.ctrlKey;
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
    if (info.shiftKey) {
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

  const handleNodePointerDown = useCallback((node: NavigationNode, info: PointerInfo) => {
    if (info.button !== 0) return;
    if (info.shiftKey) return;
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
    };

    const handleUp = async () => {
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
        return;
      }
      if (!didDrag) {
        setDragPreview(null);
        return;
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
      }
      setDragPreview(null);
      dragMovedRef.current = false;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp, { once: true });
    window.addEventListener('pointercancel', handleUp, { once: true });
  }, [basePositions, flushLayoutUpdates, layoutOptions.mode, nodeHeight, nodeWidth, positions, queueLayoutUpdates, root, tree]);

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
        isSelected: selectedNodeIds.has(id),
        isPreview: previewSelection.has(id),
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
    display,
    focusedSearchId,
    hoverNodeId,
    nodeHeight,
    nodeTabCounts,
    nodeWidth,
    openNodeIds,
    previewSelection,
    searchActive,
    searchSet,
    selectedNodeIds,
    tabStates,
    tagDefs,
    visibleDisplayNodes,
  ]);

  const particleRenderModels = useMemo<ParticleRenderModel[]>(() => {
    return particleAnimationsRef.current.map((particle) => {
      const progress = Math.min(1, particle.age / particle.life);
      const eased = 1 - Math.pow(1 - progress, 3);
      const alpha = Math.max(0, 1 - progress);
      return {
        id: particle.id,
        x: particle.startX + (particle.endX - particle.startX) * eased,
        y: particle.startY + (particle.endY - particle.startY) * eased,
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

  const connections = useMemo(
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

  useEffect(() => {
    rendererRef.current?.setData({
      nodes: renderNodes,
      connections,
      nodeWidth,
      nodeHeight,
      showConnections: effectiveShowConnections,
      particles: particleRenderModels,
    });
  }, [
    connections,
    effectiveShowConnections,
    nodeHeight,
    nodeWidth,
    particleRenderModels,
    particleVersion,
    renderNodes,
  ]);

  useEffect(() => {
    rendererRef.current?.setDetailMode(detailMode);
  }, [detailMode]);

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
    pointerDownInfoRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      button: event.button,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
    };
    const rect = wrapperRef.current.getBoundingClientRect();
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const hitNodeId = getPointerNodeId(event);
    pointerDownNodeIdRef.current = hitNodeId;
    if (hitNodeId && tree) {
      const node = tree.findNodeById(hitNodeId);
      if (node) {
        if (
          tool === 'select' &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey &&
          (!selectedNodeIds.has(node.id) || selectedNodeIds.size <= 1)
        ) {
          onSelectedNodeIdsChange(new Set([node.id]));
          selectionAnchorRef.current = node.id;
        }
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
      if (!event.shiftKey) {
        clearSelectionState();
      }
      isSelectingRef.current = true;
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
      activeNodes.forEach((pos) => {
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
    if (pointerDownNodeIdRef.current) {
      const nodeId = pointerDownNodeIdRef.current;
      pointerDownNodeIdRef.current = null;
      if (nodeDragJustEndedRef.current) {
        nodeDragJustEndedRef.current = false;
        dragMovedRef.current = false;
        pointerDownInfoRef.current = null;
        return;
      }
      if (!dragMovedRef.current) {
        const node = tree?.findNodeById(nodeId);
        if (node) {
          const info = pointerDownInfoRef.current ?? {
            clientX: event.clientX,
            clientY: event.clientY,
            button: event.button,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey,
            ctrlKey: event.ctrlKey,
          };
          handleNodeClick(node, info);
          suppressClickRef.current = true;
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
        }
      } else {
        dragMovedRef.current = false;
      }
      pointerDownInfoRef.current = null;
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
      pointerDownInfoRef.current = null;
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
          handleNodeClick(node, event);
        }
      }
    } else {
      pointerDownNodeIdRef.current = null;
    }
    pointerDownInfoRef.current = null;
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== event.pointerId) {
      return;
    }
    releasePointerCapture(event.currentTarget, activePointerIdRef.current);
    activePointerIdRef.current = null;
    nodeDragJustEndedRef.current = false;
    pointerDownNodeIdRef.current = null;
    pointerDownInfoRef.current = null;
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
    if (getPointerNodeId(event)) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
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
          cursor:
            tool === 'hand'
              ? isPanning
                ? 'grabbing'
                : 'grab'
              : hoverNodeId
                ? 'pointer'
                : 'default',
        }}
      >
        <div className="graph-canvas" ref={pixiHostRef} />
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
