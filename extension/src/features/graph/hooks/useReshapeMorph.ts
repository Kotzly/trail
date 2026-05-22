import { useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useLatest } from "@ui/hooks/use-latest";
import type { NodeId } from "@shared/types/ids.js";
import { useCameraControls } from "../motion/useCameraControls.js";
import { NODE_WIDTH, NODE_HEIGHT } from "../tree-layout.js";

const RESHAPE_DURATION_MS = 380;

type CollapseAction = { kind: "collapse" | "expand"; nodeId: NodeId } | null | undefined;

type UseReshapeMorphInput = {
  /**
   * Latest collapse / expand action from the store. Reference identity
   * changes only when a new action is committed; a stable null value
   * means "no recent reshape."
   */
  collapseAction: CollapseAction;
  /** Per-node position lookup from the current layout. */
  positions: Map<string, { x: number; y: number }>;
};

type UseReshapeMorphResult = {
  /** True while the layout-transition animation is in flight. */
  isReshaping: boolean;
};

/**
 * Layout-transition animation orchestrator.
 *
 * When the user toggles a collapse, the layout recomputes and every
 * affected node tweens to its new transform via relayout.css. Two
 * things this hook handles:
 *
 *   1. The camera follows — smoothCenter on the toggled node (zoom
 *      preserved), so the focal point stays anchored while everything
 *      morphs around it (PowerPoint-Morph feel).
 *   2. The `isReshaping` flag is exposed so the host can fade edges
 *      to ~30% opacity for the duration — SVG edges otherwise
 *      snap-update their `d` attribute to the new geometry while nodes
 *      are still tweening to it, visibly disconnecting from their
 *      endpoints during the 350ms morph.
 */
export function useReshapeMorph(input: UseReshapeMorphInput): UseReshapeMorphResult {
  const { collapseAction, positions } = input;
  const { smoothCenter } = useCameraControls();
  const { getZoom } = useReactFlow();

  const [isReshaping, setIsReshaping] = useState(false);
  const reshapeTimerRef = useRef<number | null>(null);

  // `smoothCenter` and `getZoom` identities churn while a ReactFlow
  // transition is in flight (useReactFlow returns new objects per RAF
  // during the tween). Depending on them here would re-schedule the
  // effect every frame → new center call → new tween → infinite loop.
  // Read latest via a ref bundle and fire only on a new collapseAction
  // reference (which is the user-meaningful trigger).
  const latest = useLatest({ smoothCenter, getZoom, positions });

  useEffect(() => {
    if (!collapseAction) return;
    const targetId = collapseAction.nodeId;

    setIsReshaping(true);
    if (reshapeTimerRef.current !== null) {
      window.clearTimeout(reshapeTimerRef.current);
    }
    reshapeTimerRef.current = window.setTimeout(() => {
      setIsReshaping(false);
      reshapeTimerRef.current = null;
    }, RESHAPE_DURATION_MS);

    // Defer the camera center to the next frame so the layout memo has
    // committed the new positions; reading them earlier would tween
    // toward the OLD position and look broken.
    const handle = window.requestAnimationFrame(() => {
      const {
        smoothCenter: latestSmoothCenter,
        getZoom: latestGetZoom,
        positions: latestPositions,
      } = latest.current;
      const pos = latestPositions.get(String(targetId));
      if (!pos) return;
      latestSmoothCenter(pos.x + NODE_WIDTH / 2, pos.y + NODE_HEIGHT / 2, {
        zoom: latestGetZoom(),
      });
    });

    return () => window.cancelAnimationFrame(handle);
    // `collapseAction` reference identity is the trigger — `positions`
    // is read via the latest ref so a stale snapshot can't tween to the
    // wrong place, but it must NOT re-fire the morph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapseAction]);

  useEffect(() => {
    return () => {
      if (reshapeTimerRef.current !== null) {
        window.clearTimeout(reshapeTimerRef.current);
      }
    };
  }, []);

  return { isReshaping };
}
