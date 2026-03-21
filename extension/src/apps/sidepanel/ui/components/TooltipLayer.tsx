import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../state/store.js";
import { useOverlayEffects } from "../state/overlay-effects.js";
import { Icons } from "./Icon.js";

type Placement = "top" | "bottom" | "left" | "right";

type TooltipTarget = {
  id: string;
  text: string;
  placement: Placement;
  element: HTMLElement;
};

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type Size = {
  width: number;
  height: number;
};

type HoverLayout = {
  left: number;
  top: number;
  placement: Placement;
  arrowOffsetX: number;
  arrowOffsetY: number;
};

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
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function normalizePlacement(value: string | null): Placement {
  if (value && PLACEMENTS.includes(value as Placement)) {
    return value as Placement;
  }
  return "bottom";
}

function computeBasePosition(
  placement: Placement,
  targetRect: Rect,
  tooltipRect: Rect,
): { left: number; top: number } {
  const centerX = targetRect.left + targetRect.width / 2;
  const centerY = targetRect.top + targetRect.height / 2;

  switch (placement) {
    case "top":
      return {
        left: centerX - tooltipRect.width / 2,
        top: targetRect.top - TOOLTIP_GAP - tooltipRect.height,
      };
    case "bottom":
      return {
        left: centerX - tooltipRect.width / 2,
        top: targetRect.bottom + TOOLTIP_GAP,
      };
    case "left":
      return {
        left: targetRect.left - TOOLTIP_GAP - tooltipRect.width,
        top: centerY - tooltipRect.height / 2,
      };
    case "right":
      return {
        left: targetRect.right + TOOLTIP_GAP,
        top: centerY - tooltipRect.height / 2,
      };
  }
}

function fitsWithin(left: number, top: number, tooltipRect: Rect, viewport: Rect) {
  const right = left + tooltipRect.width;
  const bottom = top + tooltipRect.height;
  return (
    left >= viewport.left &&
    right <= viewport.right &&
    top >= viewport.top &&
    bottom <= viewport.bottom
  );
}

function clampPosition(left: number, top: number, size: Size, viewport: Rect) {
  const maxLeft = Math.max(viewport.left, viewport.right - size.width);
  const maxTop = Math.max(viewport.top, viewport.bottom - size.height);
  return {
    left: clamp(left, viewport.left, maxLeft),
    top: clamp(top, viewport.top, maxTop),
  };
}

function computePreferredPosition(
  placement: Placement,
  targetRect: Rect,
  tooltipRect: Rect,
  viewport: Rect,
) {
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
  const maxX = tooltipRect.width - safePaddingX;
  const maxY = tooltipRect.height - safePaddingY;
  const arrowOffsetX = clamp(centerX - left, safePaddingX, maxX);
  const arrowOffsetY = clamp(centerY - top, safePaddingY, maxY);
  return { arrowOffsetX, arrowOffsetY };
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
      return {
        id: getIdFor(element),
        text: trimmed,
        placement: normalizePlacement(element.getAttribute("data-tooltip-position")),
        element,
      };
    },
    [getIdFor],
  );

  const updateTargets = useCallback(() => {
    if (typeof document === "undefined") return;
    if (tooltipsOpen) {
      const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-tooltip]"));
      const next = elements
        .filter((element) => isVisible(element))
        .map((element) => buildTarget(element))
        .filter((target): target is TooltipTarget => Boolean(target));
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

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- layout measurement requires synchronous state update
    updateTargets();
  }, [updateTargets]);

  const updateHoverLayout = useCallback(() => {
    if (tooltipsOpen) {
      setHoverLayout(null);
      return;
    }
    const target = targets[0];
    const bubble = hoverBubbleRef.current;
    if (!target || !bubble || typeof window === "undefined") {
      setHoverLayout(null);
      return;
    }
    const targetRect = toRect(target.element.getBoundingClientRect());
    const tooltipRect = toRect(bubble.getBoundingClientRect());
    const viewport: Rect = {
      left: VIEWPORT_PADDING,
      top: VIEWPORT_PADDING,
      right: window.innerWidth - VIEWPORT_PADDING,
      bottom: window.innerHeight - VIEWPORT_PADDING,
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const position = computePreferredPosition(target.placement, targetRect, tooltipRect, viewport);
    const arrow = computeArrowOffset(tooltipRect, targetRect, position.left, position.top);
    setHoverLayout({
      left: position.left,
      top: position.top,
      placement: position.placement,
      arrowOffsetX: arrow.arrowOffsetX,
      arrowOffsetY: arrow.arrowOffsetY,
    });
  }, [targets, tooltipsOpen]);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- layout measurement requires synchronous state update
    updateHoverLayout();
  }, [updateHoverLayout]);

  useEffect(() => {
    if (tooltipsOpen) return;
    window.addEventListener("resize", updateHoverLayout);
    window.addEventListener("scroll", updateHoverLayout, true);
    return () => {
      window.removeEventListener("resize", updateHoverLayout);
      window.removeEventListener("scroll", updateHoverLayout, true);
    };
  }, [tooltipsOpen, updateHoverLayout]);

  useEffect(() => {
    if (tooltipsOpen) return;
    const handlePointerOver = (event: PointerEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-tooltip]");
      if (!target) {
        setHoverTarget(null);
        return;
      }
      setHoverTarget(target);
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
      if (!target) return;
      setHoverTarget(target);
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
      if (event.key === "Escape") {
        event.preventDefault();
        setTooltipsOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [setTooltipsOpen, tooltipsOpen]);

  useEffect(() => {
    if (!tooltipsOpen && !hoverTarget) return;
    const observer = new MutationObserver(() => updateTargets());
    const root = tooltipsOpen ? document.body : hoverTarget;
    if (root) {
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-tooltip", "style", "class", "aria-hidden"],
      });
    }
    window.addEventListener("resize", updateTargets);
    window.addEventListener("scroll", updateTargets, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateTargets);
      window.removeEventListener("scroll", updateTargets, true);
    };
  }, [hoverTarget, tooltipsOpen, updateTargets]);

  if (typeof document === "undefined") return null;

  if (tooltipsOpen) {
    const seen = new Set<string>();
    const items = targets.reduce<string[]>((acc, target) => {
      if (seen.has(target.text)) return acc;
      seen.add(target.text);
      acc.push(target.text);
      return acc;
    }, []);

    return createPortal(
      <div
        className="modal-overlay tooltip-panel-overlay lod-enabler blur-enabler"
        onClick={() => setTooltipsOpen(false)}
      >
        <div
          className="tooltip-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tooltip-panel-title"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="tooltip-panel-header">
            <div>
              <div id="tooltip-panel-title" className="tooltip-panel-title">
                Tooltips
              </div>
              <div className="tooltip-panel-subtitle">
                {items.length === 0 ? "No tooltips available." : `${items.length} tips available.`}
              </div>
            </div>
            <button
              className="tooltip-panel-close"
              type="button"
              aria-label="Close tooltips"
              onClick={() => setTooltipsOpen(false)}
            >
              <Icons.X size={18} />
            </button>
          </div>
          {items.length === 0 ? (
            <div className="tooltip-panel-empty">Nothing to show right now.</div>
          ) : (
            <div className="tooltip-panel-list">
              {items.map((text) => (
                <div key={text} className="tooltip-panel-item">
                  {text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>,
      document.body,
    );
  }

  const hoverItem = targets[0];
  if (!hoverItem) return null;

  const bubbleStyle: React.CSSProperties | undefined = hoverLayout
    ? {
        left: `${hoverLayout.left}px`,
        top: `${hoverLayout.top}px`,
        ["--tooltip-arrow-offset-x" as string]: `${hoverLayout.arrowOffsetX}px`,
        ["--tooltip-arrow-offset-y" as string]: `${hoverLayout.arrowOffsetY}px`,
      }
    : undefined;

  return createPortal(
    <div className="tooltip-layer">
      <div
        ref={hoverBubbleRef}
        className="tooltip-bubble"
        data-placement={hoverLayout?.placement ?? hoverItem.placement}
        data-visible={hoverLayout ? "true" : "false"}
        style={bubbleStyle}
      >
        {hoverItem.text}
      </div>
    </div>,
    document.body,
  );
}
