import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../state/store.js";
import { useOverlayEffects } from "../state/overlay-effects.js";
import { Icons } from "./Icon.js";
import { Button } from "@ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@ui/components/ui/dialog";
import { ScrollArea } from "@ui/components/ui/scroll-area";

type Placement = "top" | "bottom" | "left" | "right";

type TooltipTarget = {
  id: string;
  text: string;
  placement: Placement;
  element: HTMLElement;
};

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Size = { width: number; height: number };
type HoverLayout = { left: number; top: number; placement: Placement; arrowOffsetX: number; arrowOffsetY: number };

const VIEWPORT_PADDING = 8;
const TOOLTIP_GAP = 8;
const ARROW_PADDING = 12;

const FALLBACKS: Record<Placement, Placement[]> = {
  top: ["bottom", "right", "left"],
  bottom: ["top", "right", "left"],
  left: ["right", "top", "bottom"],
  right: ["left", "top", "bottom"],
};

const PLACEMENTS: Placement[] = ["top", "bottom", "left", "right"];

function isVisible(element: HTMLElement) {
  if (!element.isConnected) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (style.opacity === "0") return false;
  return true;
}

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function toRect(rect: DOMRect): Rect {
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
}

function normalizePlacement(value: string | null): Placement {
  if (value && PLACEMENTS.includes(value as Placement)) return value as Placement;
  return "bottom";
}

function computeBasePosition(placement: Placement, targetRect: Rect, tooltipRect: Rect) {
  const centerX = targetRect.left + targetRect.width / 2;
  const centerY = targetRect.top + targetRect.height / 2;
  switch (placement) {
    case "top": return { left: centerX - tooltipRect.width / 2, top: targetRect.top - TOOLTIP_GAP - tooltipRect.height };
    case "bottom": return { left: centerX - tooltipRect.width / 2, top: targetRect.bottom + TOOLTIP_GAP };
    case "left": return { left: targetRect.left - TOOLTIP_GAP - tooltipRect.width, top: centerY - tooltipRect.height / 2 };
    case "right": return { left: targetRect.right + TOOLTIP_GAP, top: centerY - tooltipRect.height / 2 };
  }
}

function fitsWithin(left: number, top: number, tooltipRect: Rect, viewport: Rect) {
  return left >= viewport.left && left + tooltipRect.width <= viewport.right && top >= viewport.top && top + tooltipRect.height <= viewport.bottom;
}

function clampPosition(left: number, top: number, size: Size, viewport: Rect) {
  const maxLeft = Math.max(viewport.left, viewport.right - size.width);
  const maxTop = Math.max(viewport.top, viewport.bottom - size.height);
  return { left: clamp(left, viewport.left, maxLeft), top: clamp(top, viewport.top, maxTop) };
}

function computePreferredPosition(placement: Placement, targetRect: Rect, tooltipRect: Rect, viewport: Rect) {
  const order = [placement, ...FALLBACKS[placement]];
  let chosen = placement;
  let position = computeBasePosition(placement, targetRect, tooltipRect);
  for (const candidate of order) {
    const candidatePos = computeBasePosition(candidate, targetRect, tooltipRect);
    if (fitsWithin(candidatePos.left, candidatePos.top, tooltipRect, viewport)) {
      chosen = candidate;
      position = candidatePos;
      break;
    }
  }
  const clamped = clampPosition(position.left, position.top, tooltipRect, viewport);
  return { placement: chosen, left: clamped.left, top: clamped.top };
}

function computeArrowOffset(tooltipRect: Rect, targetRect: Rect, left: number, top: number) {
  const centerX = targetRect.left + targetRect.width / 2;
  const centerY = targetRect.top + targetRect.height / 2;
  const safePaddingX = Math.min(ARROW_PADDING, tooltipRect.width / 2);
  const safePaddingY = Math.min(ARROW_PADDING, tooltipRect.height / 2);
  return {
    arrowOffsetX: clamp(centerX - left, safePaddingX, tooltipRect.width - safePaddingX),
    arrowOffsetY: clamp(centerY - top, safePaddingY, tooltipRect.height - safePaddingY),
  };
}

export default function TooltipLayer() {
  const tooltipsOpen = useStore((state) => state.ui.tooltipsOpen);
  const setTooltipsOpen = useStore((state) => state.setTooltipsOpen);
  const [hoverTarget, setHoverTarget] = useState<HTMLElement | null>(null);
  const [targets, setTargets] = useState<TooltipTarget[]>([]);
  const [hoverLayout, setHoverLayout] = useState<HoverLayout | null>(null);
  const hoverBubbleRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(0);
  const idMapRef = useRef<WeakMap<HTMLElement, string>>(new WeakMap());

  useOverlayEffects(tooltipsOpen, { lod: true, blur: true, kind: "panel" });

  const getIdFor = useCallback((element: HTMLElement) => {
    const existing = idMapRef.current.get(element);
    if (existing) return existing;
    const next = `tooltip-${(idRef.current += 1)}`;
    idMapRef.current.set(element, next);
    return next;
  }, []);

  const buildTarget = useCallback(
    (element: HTMLElement): TooltipTarget | null => {
      const text = element.getAttribute("data-tooltip");
      if (!text) return null;
      const trimmed = text.trim();
      if (!trimmed) return null;
      return { id: getIdFor(element), text: trimmed, placement: normalizePlacement(element.getAttribute("data-tooltip-position")), element };
    },
    [getIdFor],
  );

  const updateTargets = useCallback(() => {
    if (typeof document === "undefined") return;
    if (tooltipsOpen) {
      const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-tooltip]"));
      const next = elements.filter(isVisible).map(buildTarget).filter((t): t is TooltipTarget => Boolean(t));
      setTargets(next);
      return;
    }
    if (hoverTarget && isVisible(hoverTarget)) {
      const target = buildTarget(hoverTarget);
      setTargets(target ? [target] : []);
      return;
    }
    setTargets([]);
  }, [buildTarget, hoverTarget, tooltipsOpen]);

  useLayoutEffect(() => { updateTargets(); }, [updateTargets]);

  const updateHoverLayout = useCallback(() => {
    if (tooltipsOpen) { setHoverLayout(null); return; }
    const target = targets[0];
    const bubble = hoverBubbleRef.current;
    if (!target || !bubble || typeof window === "undefined") { setHoverLayout(null); return; }
    const targetRect = toRect(target.element.getBoundingClientRect());
    const tooltipRect = toRect(bubble.getBoundingClientRect());
    const viewport: Rect = {
      left: VIEWPORT_PADDING, top: VIEWPORT_PADDING,
      right: window.innerWidth - VIEWPORT_PADDING, bottom: window.innerHeight - VIEWPORT_PADDING,
      width: window.innerWidth, height: window.innerHeight,
    };
    const position = computePreferredPosition(target.placement, targetRect, tooltipRect, viewport);
    const arrow = computeArrowOffset(tooltipRect, targetRect, position.left, position.top);
    setHoverLayout({ left: position.left, top: position.top, placement: position.placement, arrowOffsetX: arrow.arrowOffsetX, arrowOffsetY: arrow.arrowOffsetY });
  }, [targets, tooltipsOpen]);

  useLayoutEffect(() => { updateHoverLayout(); }, [updateHoverLayout]);

  useEffect(() => {
    if (tooltipsOpen) return;
    window.addEventListener("resize", updateHoverLayout);
    window.addEventListener("scroll", updateHoverLayout, true);
    return () => { window.removeEventListener("resize", updateHoverLayout); window.removeEventListener("scroll", updateHoverLayout, true); };
  }, [tooltipsOpen, updateHoverLayout]);

  useEffect(() => {
    if (tooltipsOpen) return;
    const handlePointerOver = (event: PointerEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-tooltip]");
      setHoverTarget(target ?? null);
    };
    const handlePointerOut = (event: PointerEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-tooltip]");
      if (!target) return;
      const related = event.relatedTarget as HTMLElement | null;
      if (related && target.contains(related)) return;
      setHoverTarget((current) => (current === target ? null : current));
    };
    const handleFocusIn = (event: FocusEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-tooltip]");
      if (target) setHoverTarget(target);
    };
    const handleFocusOut = (event: FocusEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-tooltip]");
      if (!target) return;
      const related = event.relatedTarget as HTMLElement | null;
      if (related && target.contains(related)) return;
      setHoverTarget((current) => (current === target ? null : current));
    };
    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, [tooltipsOpen]);

  useEffect(() => {
    if (!tooltipsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setTooltipsOpen(false); }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [setTooltipsOpen, tooltipsOpen]);

  useEffect(() => {
    if (!tooltipsOpen && !hoverTarget) return;
    const observer = new MutationObserver(() => updateTargets());
    const root = tooltipsOpen ? document.body : hoverTarget;
    if (root) {
      observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-tooltip", "style", "class", "aria-hidden"] });
    }
    window.addEventListener("resize", updateTargets);
    window.addEventListener("scroll", updateTargets, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", updateTargets); window.removeEventListener("scroll", updateTargets, true); };
  }, [hoverTarget, tooltipsOpen, updateTargets]);

  if (typeof document === "undefined") return null;

  // Tooltips panel (modal mode)
  if (tooltipsOpen) {
    const seen = new Set<string>();
    const items = targets.reduce<string[]>((acc, target) => {
      if (seen.has(target.text)) return acc;
      seen.add(target.text);
      acc.push(target.text);
      return acc;
    }, []);

    return (
      <Dialog open={tooltipsOpen} onOpenChange={setTooltipsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tooltips</DialogTitle>
            <DialogDescription>
              {items.length === 0 ? "No tooltips available." : `${items.length} tips available.`}
            </DialogDescription>
          </DialogHeader>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nothing to show right now.</p>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="flex flex-col gap-1">
                {items.map((text) => (
                  <div key={text} className="px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors">
                    {text}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // Hover tooltip bubble
  const hoverItem = targets[0];
  if (!hoverItem) return null;

  const bubbleStyle: React.CSSProperties | undefined = hoverLayout
    ? { left: `${hoverLayout.left}px`, top: `${hoverLayout.top}px` }
    : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[10000] pointer-events-none">
      <div
        ref={hoverBubbleRef}
        className="fixed z-[10001] px-2.5 py-1.5 text-xs rounded-md bg-popover text-popover-foreground border border-border shadow-md transition-opacity duration-100 pointer-events-none"
        style={{
          ...bubbleStyle,
          opacity: hoverLayout ? 1 : 0,
        }}
      >
        {hoverItem.text}
      </div>
    </div>,
    document.body,
  );
}
