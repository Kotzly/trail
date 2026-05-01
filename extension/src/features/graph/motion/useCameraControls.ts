/**
 * Gated wrappers around ReactFlow's camera APIs.
 *
 * ReactFlow's `setCenter` and `fitView` accept a `duration` option —
 * when it's > 0 the transition is tweened, when 0 the camera jumps.
 * The hook combines our motion platform signals (PostHog flag, FPS
 * tier, prefers-reduced-motion) to decide whether a given call animates
 * or snaps. Duration and zoom defaults live here so every call site is
 * consistent.
 *
 * Transitions are interruptible for free: ReactFlow cancels the in-flight
 * tween as soon as a new setCenter/fitView lands, which matches the §0.2
 * universal interrupt rule.
 */

import { useCallback } from "react";
import { useReactFlow, type FitViewOptions } from "@xyflow/react";
import { useMotionFlag } from "./store.js";
import { useFpsTier } from "./fps-tier.js";
import { useReducedMotion } from "./use-reduced-motion.js";

const SMOOTH_DURATION_MS = 350;
const DEFAULT_FIT_PADDING = 0.2;

export type SmoothCenterOptions = {
  /** Target zoom level; defaults to 1. */
  zoom?: number;
};

export function useCameraControls(): {
  smoothCenter: (x: number, y: number, options?: SmoothCenterOptions) => void;
  smoothFitView: (options?: FitViewOptions) => void;
} {
  const { setCenter, fitView } = useReactFlow();
  const centerEnabled = useMotionFlag("camera_smooth_center");
  const fitEnabled = useMotionFlag("camera_fit_to_view");
  const tier = useFpsTier();
  const reduced = useReducedMotion();

  const allowSmoothCenter = centerEnabled && tier !== "low" && !reduced;
  const allowSmoothFit = fitEnabled && tier !== "low" && !reduced;

  const smoothCenter = useCallback(
    (x: number, y: number, options?: SmoothCenterOptions) => {
      setCenter(x, y, {
        zoom: options?.zoom ?? 1,
        duration: allowSmoothCenter ? SMOOTH_DURATION_MS : 0,
      });
    },
    [setCenter, allowSmoothCenter],
  );

  const smoothFitView = useCallback(
    (options?: FitViewOptions) => {
      fitView({
        padding: DEFAULT_FIT_PADDING,
        ...options,
        duration: allowSmoothFit ? SMOOTH_DURATION_MS : 0,
      });
    },
    [fitView, allowSmoothFit],
  );

  return { smoothCenter, smoothFitView };
}
