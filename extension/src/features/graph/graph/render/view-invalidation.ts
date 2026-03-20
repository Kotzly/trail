import type { ViewState } from "../types.js";

export type WorldRect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type ViewInvalidationDecision = "full" | "translate-only" | "transform-only";

export type ViewInvalidationInput = {
  prevView: ViewState | null;
  nextView: ViewState;
  viewportWidth: number;
  viewportHeight: number;
  cachedCullingRect: WorldRect | null;
  forceFull?: boolean;
  originChanged?: boolean;
  scaleEpsilon?: number;
  isGesture?: boolean;
  overscanPadding?: number;
};

export function worldRectFromView(
  view: ViewState,
  viewportWidth: number,
  viewportHeight: number,
): WorldRect {
  const minX = (0 - view.translateX) / view.scale;
  const minY = (0 - view.translateY) / view.scale;
  const maxX = (viewportWidth - view.translateX) / view.scale;
  const maxY = (viewportHeight - view.translateY) / view.scale;
  return { minX, minY, maxX, maxY };
}

export function expandWorldRect(rect: WorldRect, padding: number): WorldRect {
  return {
    minX: rect.minX - padding,
    minY: rect.minY - padding,
    maxX: rect.maxX + padding,
    maxY: rect.maxY + padding,
  };
}

function rectContainsRect(outer: WorldRect, inner: WorldRect): boolean {
  return (
    outer.minX <= inner.minX &&
    outer.minY <= inner.minY &&
    outer.maxX >= inner.maxX &&
    outer.maxY >= inner.maxY
  );
}

export function decideViewInvalidation(input: ViewInvalidationInput): {
  decision: ViewInvalidationDecision;
  nextViewRect: WorldRect;
  nextCullingRect: WorldRect;
} {
  const nextViewRect = worldRectFromView(input.nextView, input.viewportWidth, input.viewportHeight);
  const overscanPx = input.overscanPadding ?? 600;
  const padding = (input.isGesture ? overscanPx : 200) / input.nextView.scale;
  const nextCullingRect = expandWorldRect(nextViewRect, padding);

  if (input.forceFull || input.originChanged) {
    return { decision: "full", nextViewRect, nextCullingRect };
  }

  const prevView = input.prevView;
  if (!prevView || !input.cachedCullingRect) {
    return { decision: "full", nextViewRect, nextCullingRect };
  }

  const epsilon = input.scaleEpsilon ?? 0.0005;
  const scaleChanged = Math.abs(prevView.scale - input.nextView.scale) > epsilon;

  // During gesture: if viewport still within cached overscan rect, skip reculling entirely
  if (input.isGesture && input.cachedCullingRect) {
    const withinOverscan = rectContainsRect(input.cachedCullingRect, nextViewRect);
    if (withinOverscan && !scaleChanged) {
      return { decision: "transform-only", nextViewRect, nextCullingRect: input.cachedCullingRect };
    }
    // Scale changed during gesture or left overscan — need full recull with new overscan
    return { decision: "full", nextViewRect, nextCullingRect };
  }

  // Non-gesture path (unchanged)
  if (scaleChanged) {
    return { decision: "full", nextViewRect, nextCullingRect };
  }

  if (!rectContainsRect(input.cachedCullingRect, nextViewRect)) {
    return { decision: "full", nextViewRect, nextCullingRect };
  }

  return { decision: "translate-only", nextViewRect, nextCullingRect };
}
