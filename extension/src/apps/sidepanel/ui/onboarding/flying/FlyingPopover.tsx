/**
 * Reusable flying popover — a draggable card that anchors to a graph
 * node when one is supplied, and falls back to a fixed bottom-center
 * panel when not. CSS transition on the anchor wrapper turns each
 * `anchorNodeId` change into a smooth flight from the previous node
 * to the new one.
 *
 * Must be mounted inside a `<ReactFlow>` subtree so xyflow's
 * `<NodeToolbar>` / `<Panel>` can resolve their context. The graph
 * package exposes a `children` slot precisely for this; see
 * `<TrailGraph>` in `@features/graph`.
 *
 * Drag interaction:
 *   - The `header` slot doubles as the drag handle. Pointer-down on it
 *     captures the pointer; subsequent moves accumulate a screen-space
 *     offset applied as `translate3d(...)` on top of the anchor's own
 *     transform. Pointer-up releases capture.
 *   - `nodrag nopan` classes opt the card out of ReactFlow's pan + node
 *     drag handlers so the gesture stays ours.
 *   - The offset resets whenever `resetKey` changes (typically when the
 *     anchor node changes). The CSS transition on the inner div animates
 *     that reset back to zero in lock-step with the wrapper's anchor
 *     flight, so the popover smoothly travels from
 *     `(oldAnchor + oldOffset) → (newAnchor + 0)`.
 */

import { useCallback, useRef, useState, type ReactNode } from "react";
import { NodeToolbar, Panel, Position } from "@xyflow/react";
import type { NodeId } from "@shared/types/ids.js";
import { Card } from "@ui/components/ui/card";
import { cn } from "@ui/lib/utils";

const FLIGHT_TRANSITION = "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)";

export type FallbackPosition = "top-center" | "bottom-center";

/** Where to attach the popover relative to its anchor node. */
export type AnchorSide = "top" | "bottom";

export type FlyingPopoverProps = {
  /**
   * The graph node to anchor to. Null → render in `fallbackPosition`
   * (default `bottom-center`) instead.
   */
  anchorNodeId: NodeId | null;
  /**
   * Side of the anchor node to attach to. Defaults to `top` (popover
   * floats above the node). Use `bottom` for prompts that should point
   * UP at the node from below.
   */
  anchorSide?: AnchorSide;
  /**
   * Where to pin the popover when there is no anchor node. Defaults
   * to `bottom-center`. Set to `top-center` for prompts that want to
   * point UP — e.g. the "pin Trail to your toolbar" prompt, where the
   * relevant UI is above the side panel.
   */
  fallbackPosition?: FallbackPosition;
  /**
   * Identity for the current "rest position." When this changes the
   * user-applied drag offset resets to zero. Pick something that
   * captures the *meaning* of "we're showing a different thing now" —
   * usually `${anchorNodeId}|${stepKey}` or similar.
   */
  resetKey: string;
  /**
   * Drag handle content. Rendered in a fixed-height bar at the top of
   * the card. Anything inside it serves as a drag affordance — but
   * interactive descendants (buttons, links) should call
   * `e.stopPropagation()` on pointerdown if they need to suppress the
   * drag start.
   */
  header: ReactNode;
  /** Card body. */
  children: ReactNode;
  /** Optional accessible name for the card region. */
  ariaLabel?: string;
  /** Optional content rendered after the body, full-bleed (e.g. progress rail). */
  footer?: ReactNode;
  /** Card width in pixels. Defaults to 280. */
  widthPx?: number;
  /**
   * Z-index for the wrapper. Defaults to 40 to sit above graph
   * decorations but below modal/dialog portals (which use 50).
   */
  zIndex?: number;
};

export function FlyingPopover({
  anchorNodeId,
  anchorSide = "top",
  fallbackPosition = "bottom-center",
  resetKey,
  header,
  children,
  ariaLabel,
  footer,
  widthPx = 280,
  zIndex = 40,
}: FlyingPopoverProps) {
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Derive-from-prop reset (no useEffect): when `resetKey` changes we
  // re-batch the offset to zero in the same render, so the inner
  // transform animates from (oldOffset) → (0) while the wrapper's own
  // anchor transition runs in lock-step.
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setDragOffset({ x: 0, y: 0 });
  }

  const draggingRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    // Buttons / links inside the header still take the click; only an
    // empty patch of the header bar starts the drag.
    if (target?.closest("button, a, [role='button']")) return;
    e.stopPropagation();
    draggingRef.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
    handleRef.current?.setPointerCapture(e.pointerId);
    setIsDragging(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = draggingRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    setDragOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = draggingRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    draggingRef.current = null;
    try {
      handleRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Capture may already be released by the browser; ignore.
    }
    setIsDragging(false);
  }, []);

  const card = (
    <div
      className={cn(
        "nodrag nopan pointer-events-auto",
        "animate-in fade-in-0 zoom-in-95 duration-200 ease-(--ease-out)",
      )}
      style={{
        transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
        transition: isDragging ? "none" : FLIGHT_TRANSITION,
        cursor: isDragging ? "grabbing" : undefined,
      }}
    >
      <Card
        role="region"
        aria-label={ariaLabel}
        className={cn("gap-0 overflow-hidden py-0 shadow-lg", "bg-popover text-popover-foreground")}
        style={{ width: widthPx }}
      >
        <div
          ref={handleRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={cn(
            "border-border/60 text-muted-foreground flex items-center gap-1.5 border-b px-4 py-2 select-none",
            "touch-none",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          {header}
        </div>
        {children}
        {footer}
      </Card>
    </div>
  );

  if (anchorNodeId) {
    return (
      <NodeToolbar
        nodeId={anchorNodeId}
        isVisible
        position={anchorSide === "bottom" ? Position.Bottom : Position.Top}
        align="center"
        offset={16}
        // CSS transition on the wrapper turns the recompute-on-anchor
        // (different node coords) into a fluid flight. While the user
        // is dragging we suspend the transition so motion feels direct,
        // not laggy.
        style={{ transition: isDragging ? "none" : FLIGHT_TRANSITION, zIndex }}
      >
        {card}
      </NodeToolbar>
    );
  }

  return (
    <Panel position={fallbackPosition} style={{ zIndex }}>
      {card}
    </Panel>
  );
}

export default FlyingPopover;
