import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { NodeId } from '@shared/types/ids.js';
import type { CanvasBounds, LayoutMode, NodePosition, ViewState } from '../../graph/types.js';
import { PADDING, NODE_WIDTH, NODE_HEIGHT, HORIZONTAL_GAP, VERTICAL_GAP } from '../../graph/layout/config.js';
import { getAnimationProgress, lerp } from '../../graph/animation-utils.js';
import { computeGraphGridTransform } from './grid-transform.js';
import type { GraphPixiRenderer } from '../../graph/render/GraphPixiRenderer.js';

type UseGraphViewParams = {
  graphView: ViewState;
  onGraphViewChange: (view: Partial<ViewState>) => void;
  rendererRef: RefObject<GraphPixiRenderer | null>;
  bounds: CanvasBounds;
  positions: Map<NodeId, NodePosition>;
  nodeWidth: number;
  nodeHeight: number;
  compactInitialView: boolean;
  currentNodeId: NodeId | null;
  root: { id: NodeId } | null;
  viewIntent: { mode?: string; intentId?: number; fitToView?: boolean; focusNodeId?: NodeId; restoreView?: ViewState } | null;
  onClearViewIntent: () => void;
  isDraggingNode: boolean;
  searchActive: boolean;
  searchNavStep: number;
  focusedSearchId: NodeId | undefined;
  resetVersion: number;
  layoutMode: LayoutMode;
  isPanningRef: RefObject<boolean>;
  isSelectingRef: RefObject<boolean>;
};

export function useGraphView({
  graphView,
  onGraphViewChange,
  rendererRef,
  bounds,
  positions,
  nodeWidth,
  nodeHeight,
  compactInitialView,
  currentNodeId,
  root,
  viewIntent,
  onClearViewIntent,
  isDraggingNode,
  searchActive,
  searchNavStep,
  focusedSearchId,
  resetVersion,
  layoutMode,
  isPanningRef,
  isSelectingRef,
}: UseGraphViewParams) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const viewAnimationRef = useRef<number | null>(null);
  const viewRef = useRef(graphView);
  const didInitView = useRef(false);
  const pendingViewRef = useRef<Partial<ViewState> | null>(null);
  const viewRafRef = useRef<number | null>(null);
  const gridVarsRef = useRef({
    size: '', dotSize: '', offsetX: '', offsetY: '',
    grainSize: '', grainOffsetX: '', grainOffsetY: '',
  });
  const lastResetRef = useRef(0);
  const lastViewIntentRef = useRef<number | null>(null);
  const lastLayoutModeRef = useRef<LayoutMode | null>(null);
  const resetStepRef = useRef<{
    nodeId: NodeId;
    view: { translateX: number; translateY: number; scale: number };
  } | null>(null);
  const prevSearchFocusRef = useRef<NodeId | null>(null);
  const lastSearchNavStepRef = useRef(searchNavStep);

  const applyGridTransform = useCallback((view: ViewState) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const grid = computeGraphGridTransform(view);
    const sizeValue = `${grid.size.toFixed(3)}px`;
    const dotValue = `${grid.dotSize.toFixed(3)}px`;
    const offsetXValue = `${grid.offsetX.toFixed(3)}px`;
    const offsetYValue = `${grid.offsetY.toFixed(3)}px`;
    const grainSizeValue = `${grid.grainSize.toFixed(3)}px`;
    const grainOffsetXValue = `${grid.grainOffsetX.toFixed(3)}px`;
    const grainOffsetYValue = `${grid.grainOffsetY.toFixed(3)}px`;
    const prev = gridVarsRef.current;
    if (
      prev.size === sizeValue && prev.dotSize === dotValue &&
      prev.offsetX === offsetXValue && prev.offsetY === offsetYValue &&
      prev.grainSize === grainSizeValue && prev.grainOffsetX === grainOffsetXValue &&
      prev.grainOffsetY === grainOffsetYValue
    ) return;
    wrapper.style.setProperty('--graph-grid-size', sizeValue);
    wrapper.style.setProperty('--graph-grid-dot-size', dotValue);
    wrapper.style.setProperty('--graph-grid-offset-x', offsetXValue);
    wrapper.style.setProperty('--graph-grid-offset-y', offsetYValue);
    wrapper.style.setProperty('--graph-grain-size', grainSizeValue);
    wrapper.style.setProperty('--graph-grain-offset-x', grainOffsetXValue);
    wrapper.style.setProperty('--graph-grain-offset-y', grainOffsetYValue);
    gridVarsRef.current = {
      size: sizeValue, dotSize: dotValue, offsetX: offsetXValue, offsetY: offsetYValue,
      grainSize: grainSizeValue, grainOffsetX: grainOffsetXValue, grainOffsetY: grainOffsetYValue,
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
    [applyGridTransform, onGraphViewChange, rendererRef],
  );

  // Cleanup rAF handles on unmount
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

  // Sync viewRef from prop changes
  useEffect(() => {
    viewRef.current = graphView;
    rendererRef.current?.setView(graphView);
    applyGridTransform(graphView);
  }, [applyGridTransform, graphView, rendererRef]);

  useEffect(() => {
    resetStepRef.current = null;
  }, [currentNodeId]);

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
    [applyGridTransform, cancelViewAnimation, onGraphViewChange, rendererRef],
  );

  const getFitToViewView = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return null;
    const rect = wrapper.getBoundingClientRect();
    const treeWidth = bounds.maxX - bounds.minX + PADDING * 2;
    const treeHeight = bounds.maxY - bounds.minY + PADDING * 2;
    if (treeWidth <= 0 || treeHeight <= 0) return null;
    const scaleToFit = Math.min(
      (rect.width * 0.9) / treeWidth,
      (rect.height * 0.9) / treeHeight,
    );
    let scale: number;
    if (compactInitialView) {
      const targetViewportX = 12 * (NODE_WIDTH + HORIZONTAL_GAP);
      const targetViewportY = 18 * (NODE_HEIGHT + VERTICAL_GAP);
      const minScale = Math.max(rect.width / targetViewportX, rect.height / targetViewportY);
      scale = Math.min(Math.max(scaleToFit, minScale), 2);
    } else {
      const maxScaleX = rect.width / (5 * (NODE_WIDTH + HORIZONTAL_GAP));
      const maxScaleY = rect.height / (5 * (NODE_HEIGHT + VERTICAL_GAP));
      scale = Math.min(scaleToFit, maxScaleX, maxScaleY, 2);
    }
    const translateX = (rect.width - treeWidth * scale) / 2 - (bounds.minX - PADDING) * scale;
    const translateY = (rect.height - treeHeight * scale) / 2 - (bounds.minY - PADDING) * scale;
    return { translateX, translateY, scale };
  }, [bounds.maxX, bounds.maxY, bounds.minX, bounds.minY, compactInitialView]);

  const fitToView = useCallback((animate = false) => {
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
  }, [animateViewTo, applyGridTransform, cancelViewAnimation, getFitToViewView, onGraphViewChange, rendererRef]);

  const getCenteredView = useCallback((nodeId: NodeId) => {
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
  }, [nodeHeight, nodeWidth, positions]);

  const isViewClose = (
    a: { translateX: number; translateY: number; scale: number },
    b: { translateX: number; translateY: number; scale: number },
  ) => {
    return (
      Math.abs(a.translateX - b.translateX) <= 0.5 &&
      Math.abs(a.translateY - b.translateY) <= 0.5 &&
      Math.abs(a.scale - b.scale) <= 0.0005
    );
  };

  const centerOnNode = useCallback((nodeId: NodeId, animate = true): boolean => {
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
  }, [animateViewTo, applyGridTransform, cancelViewAnimation, getCenteredView, onGraphViewChange, rendererRef]);

  const getScaleToFitEntireTree = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return 0.15;
    const rect = wrapper.getBoundingClientRect();
    const treeWidth = bounds.maxX - bounds.minX + PADDING * 2;
    const treeHeight = bounds.maxY - bounds.minY + PADDING * 2;
    if (treeWidth <= 0 || treeHeight <= 0) return 0.15;
    return Math.min((rect.width * 0.9) / treeWidth, (rect.height * 0.9) / treeHeight);
  }, [bounds.maxX, bounds.maxY, bounds.minX, bounds.minY]);

  const computeZoomView = useCallback(
    (pointerX: number, pointerY: number, scaleFactor: number): ViewState | null => {
      const { translateX, translateY, scale } = viewRef.current;
      const minScale = Math.min(0.15, getScaleToFitEntireTree());
      const nextScale = Math.min(3, Math.max(minScale, scale * scaleFactor));
      if (nextScale === scale) return null;
      const canvasX = (pointerX - translateX) / scale;
      const canvasY = (pointerY - translateY) / scale;
      const nextTranslateX = pointerX - canvasX * nextScale;
      const nextTranslateY = pointerY - canvasY * nextScale;
      return { translateX: nextTranslateX, translateY: nextTranslateY, scale: nextScale };
    },
    [getScaleToFitEntireTree],
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

  const zoom = useCallback((direction: 'in' | 'out' | 'reset', animate = false) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (direction === 'reset') {
      // Reset zoom logic
      const nodeId = currentNodeId;
      if (!nodeId) { resetStepRef.current = null; fitToView(animate); return; }
      const nextView = getCenteredView(nodeId);
      if (!nextView) { resetStepRef.current = null; fitToView(animate); return; }
      const snapshot = resetStepRef.current;
      if (snapshot && snapshot.nodeId === nodeId && isViewClose(viewRef.current, snapshot.view)) {
        resetStepRef.current = null; fitToView(animate); return;
      }
      if (animate) { animateViewTo(nextView, 300); }
      else {
        cancelViewAnimation(); viewRef.current = nextView;
        onGraphViewChange(nextView); rendererRef.current?.setView(nextView); applyGridTransform(nextView);
      }
      resetStepRef.current = { nodeId, view: nextView };
      return;
    }
    const rect = wrapper.getBoundingClientRect();
    const pointerX = rect.width / 2;
    const pointerY = rect.height / 2;
    const scaleFactor = direction === 'in' ? 1.25 : 0.8;
    zoomAt(pointerX, pointerY, scaleFactor, animate);
  }, [animateViewTo, applyGridTransform, cancelViewAnimation, currentNodeId, fitToView, getCenteredView, onGraphViewChange, rendererRef, zoomAt]);

  // Center on node when layout mode changes
  useLayoutEffect(() => {
    if (!root) return;
    if (lastLayoutModeRef.current === null) { lastLayoutModeRef.current = layoutMode; return; }
    if (lastLayoutModeRef.current === layoutMode) return;
    const targetId = currentNodeId ?? root.id;
    if (targetId === null || targetId === undefined) return;
    const centered = centerOnNode(targetId, true);
    if (centered) lastLayoutModeRef.current = layoutMode;
  }, [centerOnNode, currentNodeId, layoutMode, positions, root]);

  // Initial fit-to-view
  useEffect(() => {
    if (!root || didInitView.current) return;
    didInitView.current = true;
    fitToView(false);
  }, [bounds.height, bounds.width, fitToView, root]);

  // View intent handling
  useLayoutEffect(() => {
    if (!viewIntent) return;
    if (viewIntent.mode === 'soft' && (isDraggingNode || isPanningRef.current)) return;
    const intentId = viewIntent.intentId ?? 0;
    if (intentId !== 0 && lastViewIntentRef.current === intentId) return;
    if (viewIntent.restoreView) {
      lastViewIntentRef.current = intentId;
      const v = viewIntent.restoreView;
      cancelViewAnimation();
      viewRef.current = v;
      onGraphViewChange(v);
      rendererRef.current?.setView(v);
      applyGridTransform(v);
      onClearViewIntent();
      return;
    }
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
  }, [applyGridTransform, cancelViewAnimation, centerOnNode, fitToView, isDraggingNode, isPanningRef, onClearViewIntent, onGraphViewChange, positions, rendererRef, viewIntent]);

  // Reset version handling
  useEffect(() => {
    if (!root) return;
    if (resetVersion === 0) return;
    if (lastResetRef.current === resetVersion) return;
    lastResetRef.current = resetVersion;
    fitToView(true);
  }, [fitToView, resetVersion, root]);

  // Search focus centering
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
  }, [centerOnNode, focusedSearchId, isDraggingNode, isPanningRef, isSelectingRef, root, searchActive, searchNavStep, positions]);

  return {
    wrapperRef,
    viewRef,
    applyGridTransform,
    scheduleGraphView,
    cancelViewAnimation,
    animateViewTo,
    fitToView,
    centerOnNode,
    zoomAt,
    zoom,
  };
}
