import { useEffect, useEffectEvent, type RefObject } from "react";
import { useReactFlow } from "@xyflow/react";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 3;
const DELTA_CLAMP = 30;
const ZOOM_PER_DELTA = 0.006;

/**
 * Cursor-anchored zoom on Cmd/Ctrl+wheel and macOS trackpad pinch.
 *
 * Why a custom handler instead of xyflow's zoomActivationKeyCode +
 * zoomOnScroll/zoomOnPinch:
 *
 *   1. xyflow tracks the activation key via useKeyPress (window
 *      keydown/keyup). The sidepanel's window only sees keydown when
 *      it has focus — so reaching for Cmd+scroll on the graph while
 *      focus is still on the page being browsed is a no-op.
 *   2. macOS trackpad pinch arrives as a wheel event with synthetic
 *      ctrlKey=true (no real key pressed). xyflow's zoomOnPinch is
 *      gated on the same useKeyPress, so it has the same dead spot.
 *
 * Reading event.metaKey/ctrlKey directly off the wheel event sidesteps
 * both: modifier state on the event reflects OS-level state regardless
 * of focus, and pinch's synthetic ctrlKey is indistinguishable from a
 * real Ctrl press here — which is exactly what we want.
 *
 * Implementation notes:
 *   - `passive: false` is required because we conditionally
 *     `preventDefault()` (per the Vercel rule, this is the listed
 *     exception for "custom zoom controls").
 *   - useEffectEvent gives us a stable listener identity that always
 *     calls the latest closure — so the wheel subscription mounts once
 *     and never re-subscribes regardless of xyflow re-render cadence.
 */
export function useCmdWheelZoom(containerRef: RefObject<HTMLElement | null>): void {
  const { getViewport, setViewport } = useReactFlow();

  const handleWheel = useEffectEvent((event: WheelEvent) => {
    if (!event.metaKey && !event.ctrlKey) return;
    const el = containerRef.current;
    if (!el) return;

    event.preventDefault();
    event.stopPropagation();

    const vp = getViewport();
    const clamped = Math.max(-DELTA_CLAMP, Math.min(DELTA_CLAMP, event.deltaY));
    const factor = 1 - clamped * ZOOM_PER_DELTA;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * factor));

    const rect = el.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const scale = newZoom / vp.zoom;

    setViewport({
      x: mouseX - (mouseX - vp.x) * scale,
      y: mouseY - (mouseY - vp.y) * scale,
      zoom: newZoom,
    });
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    return () =>
      el.removeEventListener("wheel", handleWheel, { capture: true } as EventListenerOptions);
  }, [containerRef]);
}
