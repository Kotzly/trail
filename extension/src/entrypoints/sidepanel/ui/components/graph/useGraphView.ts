import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { NodeId } from "@shared/types/ids.js";
import type { CanvasBounds, LayoutMode, NodePosition, ViewState } from "../../graph/types.js";
import {
  PADDING,
  NODE_WIDTH,
  NODE_HEIGHT,
  HORIZONTAL_GAP,
  VERTICAL_GAP,
} from "../../graph/layout/config.js";
import { getAnimationProgress, lerp } from "../../graph/animation-utils.js";
import { computeGraphGridTransform } from "./grid-transform.js";
import type { GraphPixiRenderer } from "../../graph/render/GraphPixiRenderer.js";

type UseGraphViewParams = {
  graphView: ViewState;
  onGraphViewChange: (view: Partial<ViewState>) => void;
  rendererRef: RefObject<GraphPixiRenderer | null>;
  bounds: CanvasBounds;
  positions: Map<NodeId, NodePosition>;
  nodeWidth: number;
  nodeHeight: number;
  compactInitialView: boolean;
  initialCenterNodeId: NodeId | null;
  nodeRecency: Record<string, number>;
  currentNodeId: NodeId | null;
  root: { id: NodeId } | null;
  viewIntent: {
    mode?: string;
    intentId?: number;
    fitToView?: boolean;
    focusNodeId?: NodeId;
    restoreView?: ViewState;
  } | null;
  onClearViewIntent: () => void;
  isDraggingNode: boolean;
  searchActive: boolean;
  searchNavStep: number;
  focusedSearchId: NodeId | undefined;
  resetVersion: number;
  layoutMode: LayoutMode;
  isPanningRef: RefObject<boolean>;
  isSelectingRef: RefObject<boolean>;
  onGestureActiveChange?: (active: boolean) => void;
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
  initialCenterNodeId,
  nodeRecency,
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
  onGestureActiveChange,
}: UseGraphViewParams) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const viewAnimationRef = useRef<number | null>(null);
  const viewRef = useRef(graphView);
  const lastCommittedViewRef = useRef(graphView);
  const didInitView = useRef(false);
  const pendingViewRef = useRef<Partial<ViewState> | null>(null);
  const viewRafRef = useRef<number | null>(null);
  const wheelIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureActiveRef = useRef(false);
  const pendingIsGestureRef = useRef(false);
  const onGestureActiveChangeRef = useRef(onGestureActiveChange);
  const gridVarsRef = useRef({
    size: "",
    dotSize: "",
    offsetX: "",
    offsetY: "",
    grainSize: "",
    grainOffsetX: "",
    grainOffsetY: "",
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
  const driftRafRef = useRef<number | null>(null);
  const driftOffsetRef = useRef({ x: 0, y: 0 });
  const driftStartRef = useRef(0);
  const driftCooldownUntilRef = useRef(0);

  // Keep ref in sync with latest prop so callbacks don't need to be in dep arrays
  useEffect(() => {
    onGestureActiveChangeRef.current = onGestureActiveChange;
  }, [onGestureActiveChange]);

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
      prev.size === sizeValue &&
      prev.dotSize === dotValue &&
      prev.offsetX === offsetXValue &&
      prev.offsetY === offsetYValue &&
      prev.grainSize === grainSizeValue &&
      prev.grainOffsetX === grainOffsetXValue &&
      prev.grainOffsetY === grainOffsetYValue
    )
      return;
    wrapper.style.setProperty("--graph-grid-size", sizeValue);
    wrapper.style.setProperty("--graph-grid-dot-size", dotValue);
    wrapper.style.setProperty("--graph-grid-offset-x", offsetXValue);
    wrapper.style.setProperty("--graph-grid-offset-y", offsetYValue);
    wrapper.style.setProperty("--graph-grain-size", grainSizeValue);
    wrapper.style.setProperty("--graph-grain-offset-x", grainOffsetXValue);
    wrapper.style.setProperty("--graph-grain-offset-y", grainOffsetYValue);
    gridVarsRef.current = {
      size: sizeValue,
      dotSize: dotValue,
      offsetX: offsetXValue,
      offsetY: offsetYValue,
      grainSize: grainSizeValue,
      grainOffsetX: grainOffsetXValue,
      grainOffsetY: grainOffsetYValue,
    };
  }, []);

  // Fold any active drift visual offset into the canonical viewRef
  // so subsequent user interaction starts from the visually-correct position.
  const absorbDriftOffset = useCallback(() => {
    const now = performance.now();
    // Suppress drift for 200ms after any user view change
    driftCooldownUntilRef.current = now + 200;
    const { x, y } = driftOffsetRef.current;
    if (x === 0 && y === 0) return;
    viewRef.current = {
      ...viewRef.current,
      translateX: viewRef.current.translateX + x,
      translateY: viewRef.current.translateY + y,
    };
    driftOffsetRef.current = { x: 0, y: 0 };
    driftStartRef.current = now;
  }, []);

  const commitViewToStore = useCallback(() => {
    const view = viewRef.current;
    lastCommittedViewRef.current = view;
    onGraphViewChange(view);
  }, [onGraphViewChange]);

  const setGestureActiveState = useCallback((active: boolean) => {
    gestureActiveRef.current = active;
    onGestureActiveChangeRef.current?.(active);
  }, []);

  const scheduleGestureIdle = useCallback(() => {
    if (gestureIdleTimerRef.current !== null) {
      clearTimeout(gestureIdleTimerRef.current);
    }
    gestureIdleTimerRef.current = setTimeout(() => {
      gestureIdleTimerRef.current = null;
      setGestureActiveState(false);
    }, 200);
  }, [setGestureActiveState]);

  const scheduleGraphView = useCallback(
    (view: Partial<ViewState>, isGesture = false) => {
      absorbDriftOffset();
      viewRef.current = { ...viewRef.current, ...view };
      pendingViewRef.current = { ...(pendingViewRef.current ?? {}), ...view };
      // Track whether the pending RAF represents a gesture or not.
      // If any batched call is a gesture, the whole batch is treated as gesture.
      pendingIsGestureRef.current = pendingIsGestureRef.current || isGesture;

      if (isGesture) {
        // Mark gesture active
        if (!gestureActiveRef.current) {
          setGestureActiveState(true);
        }
        // Wheel-idle: commit view to store after 150ms without a new wheel event
        if (wheelIdleTimerRef.current !== null) {
          clearTimeout(wheelIdleTimerRef.current);
        }
        wheelIdleTimerRef.current = setTimeout(() => {
          wheelIdleTimerRef.current = null;
          commitViewToStore();
        }, 150);
        // Gesture-idle: restore quality after 200ms
        scheduleGestureIdle();
      }

      if (viewRafRef.current !== null) return;
      viewRafRef.current = window.requestAnimationFrame(() => {
        const next = pendingViewRef.current;
        const wasGesture = pendingIsGestureRef.current;
        pendingViewRef.current = null;
        pendingIsGestureRef.current = false;
        viewRafRef.current = null;
        if (next) {
          // During gestures, skip the Zustand write (handled by wheel-idle or pointerUp)
          if (!wasGesture) {
            onGraphViewChange(next);
            lastCommittedViewRef.current = { ...lastCommittedViewRef.current, ...next };
          }
          rendererRef.current?.setView(viewRef.current, wasGesture);
          applyGridTransform(viewRef.current);
        }
      });
    },
    [
      absorbDriftOffset,
      applyGridTransform,
      commitViewToStore,
      onGraphViewChange,
      rendererRef,
      scheduleGestureIdle,
      setGestureActiveState,
    ],
  );

  // Commit view on pointerUp (pan end) -- call from GraphCanvas
  const commitViewOnGestureEnd = useCallback(() => {
    if (wheelIdleTimerRef.current !== null) {
      clearTimeout(wheelIdleTimerRef.current);
      wheelIdleTimerRef.current = null;
    }
    commitViewToStore();
    scheduleGestureIdle();
  }, [commitViewToStore, scheduleGestureIdle]);

  // Cleanup rAF handles and timers on unmount
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
      if (driftRafRef.current !== null) {
        window.cancelAnimationFrame(driftRafRef.current);
        driftRafRef.current = null;
      }
      if (wheelIdleTimerRef.current !== null) {
        clearTimeout(wheelIdleTimerRef.current);
        wheelIdleTimerRef.current = null;
      }
      if (gestureIdleTimerRef.current !== null) {
        clearTimeout(gestureIdleTimerRef.current);
        gestureIdleTimerRef.current = null;
      }
      pendingIsGestureRef.current = false;
      // Flush any uncommitted view to store on unmount
      const current = viewRef.current;
      const committed = lastCommittedViewRef.current;
      if (
        current.translateX !== committed.translateX ||
        current.translateY !== committed.translateY ||
        current.scale !== committed.scale
      ) {
        onGraphViewChange(current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    absorbDriftOffset();
  }, [absorbDriftOffset]);

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
          // Reset drift phase so it resumes from 0 offset after animation
          driftOffsetRef.current = { x: 0, y: 0 };
          driftStartRef.current = performance.now();
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
    const scaleToFit = Math.min((rect.width * 0.9) / treeWidth, (rect.height * 0.9) / treeHeight);
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

  const getRecencyCentroidView = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !nodeRecency) return null;
    const rect = wrapper.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    // Top 8 most-recent nodes that exist in the layout
    const entries = Object.entries(nodeRecency)
      .filter(([id, ts]) => ts > 0 && positions.has(Number(id) as NodeId))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    if (entries.length < 3) return null;

    let sumX = 0;
    let sumY = 0;
    for (const [id] of entries) {
      const pos = positions.get(Number(id) as NodeId)!;
      sumX += pos.x + nodeWidth / 2;
      sumY += pos.y + nodeHeight / 2;
    }
    const centroidX = sumX / entries.length;
    const centroidY = sumY / entries.length;

    // Same scale logic as compactInitialView in getFitToViewView
    const treeWidth = bounds.maxX - bounds.minX + PADDING * 2;
    const treeHeight = bounds.maxY - bounds.minY + PADDING * 2;
    if (treeWidth <= 0 || treeHeight <= 0) return null;
    const scaleToFit = Math.min((rect.width * 0.9) / treeWidth, (rect.height * 0.9) / treeHeight);
    const targetViewportX = 12 * (NODE_WIDTH + HORIZONTAL_GAP);
    const targetViewportY = 18 * (NODE_HEIGHT + VERTICAL_GAP);
    const minScale = Math.max(rect.width / targetViewportX, rect.height / targetViewportY);
    const scale = Math.min(Math.max(scaleToFit, minScale), 2);

    const translateX = rect.width / 2 - centroidX * scale;
    const translateY = rect.height / 2 - centroidY * scale;
    return { translateX, translateY, scale };
  }, [
    bounds.maxX,
    bounds.maxY,
    bounds.minX,
    bounds.minY,
    nodeHeight,
    nodeRecency,
    nodeWidth,
    positions,
  ]);

  const fitToView = useCallback(
    (animate = false) => {
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
        driftOffsetRef.current = { x: 0, y: 0 };
        driftStartRef.current = performance.now();
      }
    },
    [
      animateViewTo,
      applyGridTransform,
      cancelViewAnimation,
      getFitToViewView,
      onGraphViewChange,
      rendererRef,
    ],
  );

  const getCenteredView = useCallback(
    (nodeId: NodeId) => {
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
    },
    [nodeHeight, nodeWidth, positions],
  );

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

  const centerOnNode = useCallback(
    (nodeId: NodeId, animate = true): boolean => {
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
        driftOffsetRef.current = { x: 0, y: 0 };
        driftStartRef.current = performance.now();
      }
      return true;
    },
    [
      animateViewTo,
      applyGridTransform,
      cancelViewAnimation,
      getCenteredView,
      onGraphViewChange,
      rendererRef,
    ],
  );

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
        scheduleGraphView(nextView, true);
      }
    },
    [animateViewTo, computeZoomView, scheduleGraphView],
  );

  const zoom = useCallback(
    (direction: "in" | "out" | "reset", animate = false) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      if (direction === "reset") {
        // Reset zoom logic
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
        return;
      }
      const rect = wrapper.getBoundingClientRect();
      const pointerX = rect.width / 2;
      const pointerY = rect.height / 2;
      const scaleFactor = direction === "in" ? 1.25 : 0.8;
      zoomAt(pointerX, pointerY, scaleFactor, animate);
    },
    [
      animateViewTo,
      applyGridTransform,
      cancelViewAnimation,
      currentNodeId,
      fitToView,
      getCenteredView,
      onGraphViewChange,
      rendererRef,
      zoomAt,
    ],
  );

  // Center on node when layout mode changes
  useLayoutEffect(() => {
    if (!root) return;
    if (lastLayoutModeRef.current === null) {
      lastLayoutModeRef.current = layoutMode;
      return;
    }
    if (lastLayoutModeRef.current === layoutMode) return;
    const targetId = currentNodeId ?? root.id;
    if (targetId === null || targetId === undefined) return;
    const centered = centerOnNode(targetId, true);
    if (centered) lastLayoutModeRef.current = layoutMode;
  }, [centerOnNode, currentNodeId, layoutMode, positions, root]);

  // Initial fit-to-view (with recency centroid for compact/newtab mode)
  useEffect(() => {
    if (!root || didInitView.current) return;
    didInitView.current = true;
    if (compactInitialView) {
      // If a specific node is requested, center on it with the compact scale
      if (initialCenterNodeId && positions.has(initialCenterNodeId)) {
        const fitView = getFitToViewView();
        const centered = getCenteredView(initialCenterNodeId);
        if (fitView && centered) {
          const view = {
            translateX: centered.translateX,
            translateY: centered.translateY,
            scale: fitView.scale,
          };
          cancelViewAnimation();
          viewRef.current = view;
          onGraphViewChange(view);
          rendererRef.current?.setView(view);
          applyGridTransform(view);
          driftStartRef.current = performance.now();
          return;
        }
      }
      // Fall back to recency centroid
      const centroidView = getRecencyCentroidView();
      if (centroidView) {
        cancelViewAnimation();
        viewRef.current = centroidView;
        onGraphViewChange(centroidView);
        rendererRef.current?.setView(centroidView);
        applyGridTransform(centroidView);
        driftStartRef.current = performance.now();
        return;
      }
    }
    fitToView(false);
    if (compactInitialView) {
      driftStartRef.current = performance.now();
    }
  }, [
    bounds.height,
    bounds.width,
    fitToView,
    root,
    compactInitialView,
    initialCenterNodeId,
    getRecencyCentroidView,
    getCenteredView,
    getFitToViewView,
    cancelViewAnimation,
    onGraphViewChange,
    rendererRef,
    applyGridTransform,
    positions,
  ]);

  // Lissajous drift — visual-only offset layer (newtab only).
  // NEVER writes to viewRef — only shifts the rendered view.
  // When user interaction starts, absorbDriftOffset folds offset into viewRef.
  useEffect(() => {
    // Lissajous drift disabled — continuous 60fps RAF loop burned CPU/GPU
    // for a barely-visible ambient effect. Static graph is fine.
    return;
  }, [compactInitialView, applyGridTransform, isPanningRef, isSelectingRef, rendererRef]);

  // View intent handling
  useLayoutEffect(() => {
    if (!viewIntent) return;
    if (viewIntent.mode === "soft" && (isDraggingNode || isPanningRef.current)) return;
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
      driftOffsetRef.current = { x: 0, y: 0 };
      driftStartRef.current = performance.now();
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
      centerOnNode(viewIntent.focusNodeId, false);
      onClearViewIntent();
    }
  }, [
    applyGridTransform,
    cancelViewAnimation,
    centerOnNode,
    fitToView,
    isDraggingNode,
    isPanningRef,
    onClearViewIntent,
    onGraphViewChange,
    positions,
    rendererRef,
    viewIntent,
  ]);

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
  }, [
    centerOnNode,
    focusedSearchId,
    isDraggingNode,
    isPanningRef,
    isSelectingRef,
    root,
    searchActive,
    searchNavStep,
    positions,
  ]);

  return {
    wrapperRef,
    viewRef,
    applyGridTransform,
    scheduleGraphView,
    commitViewOnGestureEnd,
    cancelViewAnimation,
    animateViewTo,
    fitToView,
    centerOnNode,
    zoomAt,
    zoom,
  };
}
