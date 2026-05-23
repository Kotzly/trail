/**
 * Gated wrappers around ReactFlow's camera APIs.
 *
 * ReactFlow's `setCenter` and `fitView` accept a `duration` option —
 * when it's > 0 the transition is tweened, when 0 the camera jumps.
 * The hook combines our motion platform signals (PostHog flag and
 * prefers-reduced-motion) to decide whether a given call animates or
 * snaps. Duration and zoom defaults live here so every call site is
 * consistent.
 *
 * Transitions are interruptible for free: ReactFlow cancels the in-flight
 * tween as soon as a new setCenter/fitView lands, which matches the §0.2
 * universal interrupt rule.
 */

import { useCallback, useLayoutEffect, useRef } from "react";
import { useReactFlow, useStore, useStoreApi, type ReactFlowState } from "@xyflow/react";
import { useMotionFlag } from "./store.js";
import { useReducedMotion } from "./use-reduced-motion.js";

const SMOOTH_DURATION_MS = 350;

const selectWidth = (s: ReactFlowState) => s.width;
const selectHeight = (s: ReactFlowState) => s.height;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export type SmoothCenterOptions = {
  /**
   * Target zoom level. Default: preserve the current zoom (the user's
   * own zoom level is the most useful camera state to keep across
   * navigation hops). Pass an explicit value only when you actually
   * want to reset the zoom — e.g., the initial bootstrap fitView.
   */
  zoom?: number;
};

export function useCameraControls(): {
  smoothCenter: (x: number, y: number, options?: SmoothCenterOptions) => void;
} {
  const { getZoom, getViewport, setViewport } = useReactFlow();
  // `useStoreApi` returns a memoized handle whose identity is stable for the
  // lifetime of the ReactFlowProvider. Reading width/height/transform off
  // `getState()` at CALL time (rather than via `useStore` subscription)
  // keeps smoothCenter's identity from churning on every resize tick.
  const storeApi = useStoreApi();
  // Still subscribe to width/height for the deferred-target replay effect
  // below — the effect MUST re-fire when xyflow's measured dimensions
  // transition from 0 → real, otherwise a center scheduled before the
  // measurement never lands.
  const viewportWidth = useStore(selectWidth);
  const viewportHeight = useStore(selectHeight);
  const centerEnabled = useMotionFlag("camera_smooth_center");
  const reduced = useReducedMotion();

  const allowSmoothCenter = centerEnabled && !reduced;

  const tweenRafRef = useRef<number | null>(null);
  // Deferred-center queue. On initial mount xyflow's `width`/`height`
  // store fields are 0 until its ResizeObserver fires (~1 frame after
  // first paint). Running the centering math with 0 dimensions produces
  // viewport (0, 0), parking the target node at the screen's top-left.
  // Callers shouldn't have to know about this race — we stash the
  // request here and replay it (snapped, not tweened) when dimensions
  // arrive via the effect below.
  const pendingTargetRef = useRef<{
    flowX: number;
    flowY: number;
    options?: SmoothCenterOptions;
  } | null>(null);

  /**
   * Custom rAF-driven viewport tween. Replaces xyflow's `setCenter`,
   * which routes through d3-zoom's `interpolateZoom` and uses van
   * Wijk's smooth-zoom algorithm — it deliberately ARCS through a
   * lower zoom level when the screen-space distance is large, even
   * if start and end zoom are equal. Visually: unzoom → translate →
   * zoom back in. Not what the user wants when they navigate to a
   * far node at the same zoom.
   *
   * This implementation linearly interpolates viewport.x / .y / .zoom
   * over `SMOOTH_DURATION_MS` with a cubic ease. Same zoom in/out =
   * pure translate, no arc. Far-distance moves still look smooth, no
   * extra zoom animation.
   */
  const smoothCenter = useCallback(
    (flowX: number, flowY: number, options?: SmoothCenterOptions) => {
      const { width, height } = storeApi.getState();
      if (width === 0 || height === 0) {
        // Defer until xyflow measures the container. Last call wins —
        // matches the in-flight tween's universal-interrupt semantics.
        pendingTargetRef.current = { flowX, flowY, options };
        return;
      }
      pendingTargetRef.current = null;

      if (tweenRafRef.current !== null) {
        cancelAnimationFrame(tweenRafRef.current);
        tweenRafRef.current = null;
      }

      const targetZoom = options?.zoom ?? getZoom();
      const targetVpX = width / 2 - flowX * targetZoom;
      const targetVpY = height / 2 - flowY * targetZoom;

      if (!allowSmoothCenter) {
        setViewport({ x: targetVpX, y: targetVpY, zoom: targetZoom });
        return;
      }

      const start = getViewport();
      const dx = targetVpX - start.x;
      const dy = targetVpY - start.y;
      const dz = targetZoom - start.zoom;
      // No-op tween: already there.
      if (dx === 0 && dy === 0 && dz === 0) return;

      const t0 = performance.now();
      const step = (now: number) => {
        const elapsed = now - t0;
        const p = Math.min(1, elapsed / SMOOTH_DURATION_MS);
        const e = easeInOutCubic(p);
        setViewport({
          x: start.x + dx * e,
          y: start.y + dy * e,
          zoom: start.zoom + dz * e,
        });
        if (p < 1) {
          tweenRafRef.current = requestAnimationFrame(step);
        } else {
          tweenRafRef.current = null;
        }
      };
      tweenRafRef.current = requestAnimationFrame(step);
    },
    [storeApi, getZoom, getViewport, setViewport, allowSmoothCenter],
  );

  // Replay any deferred center as soon as xyflow finishes measuring.
  // `useLayoutEffect` so the corrected viewport lands before the
  // browser paints the first frame with valid dimensions — otherwise
  // there's a one-frame flash of the node at the screen's top-left.
  // Snap rather than tween: the pre-measurement viewport (0, 0, 1) is
  // a placeholder, not a meaningful origin, so animating from it would
  // look like the node is flying in.
  useLayoutEffect(() => {
    if (viewportWidth === 0 || viewportHeight === 0) return;
    const pending = pendingTargetRef.current;
    if (pending === null) return;
    pendingTargetRef.current = null;
    const targetZoom = pending.options?.zoom ?? getZoom();
    setViewport({
      x: viewportWidth / 2 - pending.flowX * targetZoom,
      y: viewportHeight / 2 - pending.flowY * targetZoom,
      zoom: targetZoom,
    });
  }, [viewportWidth, viewportHeight, getZoom, setViewport]);

  return { smoothCenter };
}
