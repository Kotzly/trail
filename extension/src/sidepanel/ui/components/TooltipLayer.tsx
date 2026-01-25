import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../state/store.js';
import React from 'react';

type Placement = 'top' | 'bottom' | 'left' | 'right';

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

type TooltipTarget = {
  id: string;
  text: string;
  placement: Placement;
  element: HTMLElement;
};

type TooltipBox = {
  id: string;
  text: string;
  placement: Placement;
  left: number;
  top: number;
  width: number;
  height: number;
  targetRect: Rect;
};

type TooltipLayout = {
  id: string;
  text: string;
  placement: Placement;
  left: number;
  top: number;
  arrowOffsetX: number;
  arrowOffsetY: number;
};

const VIEWPORT_PADDING = 8;
const TOOLTIP_GAP = 8;
const OVERLAP_GAP = 6;
const ARROW_PADDING = 12;

const FALLBACKS: Record<Placement, Placement[]> = {
  top: ['bottom', 'right', 'left'],
  bottom: ['top', 'right', 'left'],
  left: ['right', 'top', 'bottom'],
  right: ['left', 'top', 'bottom'],
};

const PLACEMENTS: Placement[] = ['top', 'bottom', 'left', 'right'];

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

function isVisible(element: HTMLElement) {
  if (!element.isConnected) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;
  return true;
}

function normalizePlacement(value: string | null): Placement {
  if (value && PLACEMENTS.includes(value as Placement)) {
    return value as Placement;
  }
  return 'bottom';
}

function computeBasePosition(
  placement: Placement,
  targetRect: Rect,
  tooltipRect: Rect,
): { left: number; top: number } {
  const centerX = targetRect.left + targetRect.width / 2;
  const centerY = targetRect.top + targetRect.height / 2;

  switch (placement) {
    case 'top':
      return {
        left: centerX - tooltipRect.width / 2,
        top: targetRect.top - TOOLTIP_GAP - tooltipRect.height,
      };
    case 'bottom':
      return {
        left: centerX - tooltipRect.width / 2,
        top: targetRect.bottom + TOOLTIP_GAP,
      };
    case 'left':
      return {
        left: targetRect.left - TOOLTIP_GAP - tooltipRect.width,
        top: centerY - tooltipRect.height / 2,
      };
    case 'right':
      return {
        left: targetRect.right + TOOLTIP_GAP,
        top: centerY - tooltipRect.height / 2,
      };
  }
}

function fitsWithin(
  left: number,
  top: number,
  tooltipRect: Rect,
  viewport: Rect,
) {
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

function intersects(a: TooltipBox, b: TooltipBox) {
  return !(
    a.left + a.width + OVERLAP_GAP <= b.left ||
    a.left >= b.left + b.width + OVERLAP_GAP ||
    a.top + a.height + OVERLAP_GAP <= b.top ||
    a.top >= b.top + b.height + OVERLAP_GAP
  );
}

function clampRect(rect: TooltipBox, viewport: Rect) {
  const clamped = clampPosition(rect.left, rect.top, rect, viewport);
  rect.left = clamped.left;
  rect.top = clamped.top;
  return rect;
}

function shiftHorizontal(rect: TooltipBox, overlap: TooltipBox, viewport: Rect) {
  const moveRight = overlap.left + overlap.width + OVERLAP_GAP - rect.left;
  const moveLeft = overlap.left - OVERLAP_GAP - rect.width - rect.left;
  const canMoveRight = rect.left + moveRight + rect.width <= viewport.right;
  const canMoveLeft = rect.left + moveLeft >= viewport.left;

  if (canMoveRight && (!canMoveLeft || Math.abs(moveRight) <= Math.abs(moveLeft))) {
    rect.left += moveRight;
    return true;
  }
  if (canMoveLeft) {
    rect.left += moveLeft;
    return true;
  }
  return false;
}

function shiftVertical(rect: TooltipBox, overlap: TooltipBox, viewport: Rect) {
  const moveDown = overlap.top + overlap.height + OVERLAP_GAP - rect.top;
  const moveUp = overlap.top - OVERLAP_GAP - rect.height - rect.top;
  const canMoveDown = rect.top + moveDown + rect.height <= viewport.bottom;
  const canMoveUp = rect.top + moveUp >= viewport.top;

  if (canMoveDown && (!canMoveUp || Math.abs(moveDown) <= Math.abs(moveUp))) {
    rect.top += moveDown;
    return true;
  }
  if (canMoveUp) {
    rect.top += moveUp;
    return true;
  }
  return false;
}

function resolveCollisions(items: TooltipBox[], viewport: Rect) {
  const placed: TooltipBox[] = [];
  const resolved: TooltipBox[] = [];
  const sorted = [...items].sort((a, b) => a.top - b.top || a.left - b.left);

  for (const item of sorted) {
    let next = { ...item };
    let tries = 0;
    const primaryAxis = item.placement === 'left' || item.placement === 'right' ? 'y' : 'x';

    while (placed.some((rect) => intersects(next, rect)) && tries < 12) {
      const overlap = placed.find((rect) => intersects(next, rect));
      if (!overlap) break;
      const moved =
        primaryAxis === 'x'
          ? shiftHorizontal(next, overlap, viewport) || shiftVertical(next, overlap, viewport)
          : shiftVertical(next, overlap, viewport) || shiftHorizontal(next, overlap, viewport);
      if (!moved) break;
      next = clampRect(next, viewport);
      tries += 1;
    }

    placed.push(next);
    resolved.push(next);
  }

  const byId = new Map(resolved.map((item) => [item.id, item]));
  return items.map((item) => byId.get(item.id) ?? item);
}

function computeArrowOffset(
  tooltip: TooltipBox,
  targetRect: Rect,
): { arrowOffsetX: number; arrowOffsetY: number } {
  const centerX = targetRect.left + targetRect.width / 2;
  const centerY = targetRect.top + targetRect.height / 2;
  const safePaddingX = Math.min(ARROW_PADDING, tooltip.width / 2);
  const safePaddingY = Math.min(ARROW_PADDING, tooltip.height / 2);
  const maxX = tooltip.width - safePaddingX;
  const maxY = tooltip.height - safePaddingY;
  const arrowOffsetX = clamp(centerX - tooltip.left, safePaddingX, maxX);
  const arrowOffsetY = clamp(centerY - tooltip.top, safePaddingY, maxY);
  return { arrowOffsetX, arrowOffsetY };
}

export default function TooltipLayer() {
  const tooltipsOpen = useStore((state) => state.ui.tooltipsOpen);
  const [hoverTarget, setHoverTarget] = useState<HTMLElement | null>(null);
  const [targets, setTargets] = useState<TooltipTarget[]>([]);
  const [layouts, setLayouts] = useState<Record<string, TooltipLayout>>({});
  const tooltipRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const idRef = useRef(0);
  const idMapRef = useRef<WeakMap<HTMLElement, string>>(new WeakMap());

  const mode = tooltipsOpen ? 'all' : 'hover';

  const getIdFor = useCallback((element: HTMLElement) => {
    const existing = idMapRef.current.get(element);
    if (existing) return existing;
    const next = `tooltip-${idRef.current += 1}`;
    idMapRef.current.set(element, next);
    return next;
  }, []);

  const buildTarget = useCallback(
    (element: HTMLElement): TooltipTarget | null => {
      const text = element.getAttribute('data-tooltip');
      if (!text) return null;
      const trimmed = text.trim();
      if (!trimmed) return null;
      return {
        id: getIdFor(element),
        text: trimmed,
        placement: normalizePlacement(element.getAttribute('data-tooltip-position')),
        element,
      };
    },
    [getIdFor],
  );

  const updateTargets = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (tooltipsOpen) {
      const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-tooltip]'));
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
    updateTargets();
  }, [updateTargets]);

  useLayoutEffect(() => {
    if (!targets.length) {
      setLayouts({});
      return;
    }
    if (typeof window === 'undefined') return;

    const viewport: Rect = {
      left: VIEWPORT_PADDING,
      top: VIEWPORT_PADDING,
      right: window.innerWidth - VIEWPORT_PADDING,
      bottom: window.innerHeight - VIEWPORT_PADDING,
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const boxes: TooltipBox[] = [];

    for (const target of targets) {
      const tooltipEl = tooltipRefs.current.get(target.id);
      if (!tooltipEl) continue;
      const targetRect = toRect(target.element.getBoundingClientRect());
      const tooltipRect = toRect(tooltipEl.getBoundingClientRect());
      const base = computePreferredPosition(target.placement, targetRect, tooltipRect, viewport);
      boxes.push({
        id: target.id,
        text: target.text,
        placement: base.placement,
        left: base.left,
        top: base.top,
        width: tooltipRect.width,
        height: tooltipRect.height,
        targetRect,
      });
    }

    const resolved = mode === 'all' ? resolveCollisions(boxes, viewport) : boxes;
    const nextLayouts: Record<string, TooltipLayout> = {};
    for (const item of resolved) {
      const arrow = computeArrowOffset(item, item.targetRect);
      nextLayouts[item.id] = {
        id: item.id,
        text: item.text,
        placement: item.placement,
        left: item.left,
        top: item.top,
        arrowOffsetX: arrow.arrowOffsetX,
        arrowOffsetY: arrow.arrowOffsetY,
      };
    }
    setLayouts(nextLayouts);
  }, [mode, targets]);

  useEffect(() => {
    if (!tooltipsOpen) return;
    const observer = new MutationObserver(() => updateTargets());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-tooltip', 'data-tooltip-position', 'style', 'class', 'aria-hidden'],
    });
    window.addEventListener('resize', updateTargets);
    window.addEventListener('scroll', updateTargets, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateTargets);
      window.removeEventListener('scroll', updateTargets, true);
    };
  }, [tooltipsOpen, updateTargets]);

  useEffect(() => {
    if (tooltipsOpen) return;
    if (!hoverTarget) return;
    const observer = new MutationObserver(() => updateTargets());
    observer.observe(hoverTarget, {
      attributes: true,
      attributeFilter: ['data-tooltip', 'data-tooltip-position', 'style', 'class', 'aria-hidden'],
    });
    window.addEventListener('resize', updateTargets);
    window.addEventListener('scroll', updateTargets, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateTargets);
      window.removeEventListener('scroll', updateTargets, true);
    };
  }, [hoverTarget, tooltipsOpen, updateTargets]);

  useEffect(() => {
    if (tooltipsOpen) return;
    const handlePointerOver = (event: PointerEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-tooltip]');
      if (!target) {
        setHoverTarget(null);
        return;
      }
      setHoverTarget(target);
    };

    const handlePointerOut = (event: PointerEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-tooltip]');
      if (!target) return;
      const related = event.relatedTarget as HTMLElement | null;
      if (related && target.contains(related)) return;
      setHoverTarget((current) => (current === target ? null : current));
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-tooltip]');
      if (!target) return;
      setHoverTarget(target);
    };

    const handleFocusOut = (event: FocusEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-tooltip]');
      if (!target) return;
      const related = event.relatedTarget as HTMLElement | null;
      if (related && target.contains(related)) return;
      setHoverTarget((current) => (current === target ? null : current));
    };

    document.addEventListener('pointerover', handlePointerOver);
    document.addEventListener('pointerout', handlePointerOut);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('pointerover', handlePointerOver);
      document.removeEventListener('pointerout', handlePointerOut);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [tooltipsOpen]);

  const tooltipNodes = useMemo(() => {
    return targets.map((target) => {
      const layout = layouts[target.id];
      const isVisible = Boolean(layout);
      const style: React.CSSProperties | undefined = layout
        ? {
            left: `${layout.left}px`,
            top: `${layout.top}px`,
            ['--tooltip-arrow-offset-x' as string]: `${layout.arrowOffsetX}px`,
            ['--tooltip-arrow-offset-y' as string]: `${layout.arrowOffsetY}px`,
          }
        : undefined;

      return (
        <div
          key={target.id}
          ref={(node) => {
            if (node) {
              tooltipRefs.current.set(target.id, node);
            } else {
              tooltipRefs.current.delete(target.id);
            }
          }}
          className="tooltip-bubble"
          data-placement={layout?.placement ?? target.placement}
          data-visible={isVisible ? 'true' : 'false'}
          style={style}
        >
          {target.text}
        </div>
      );
    });
  }, [layouts, targets]);

  if (typeof document === 'undefined') return null;
  if (tooltipNodes.length === 0) return null;

  return createPortal(
    <div className="tooltip-layer" data-mode={mode}>
      {tooltipNodes}
    </div>,
    document.body,
  );
}
