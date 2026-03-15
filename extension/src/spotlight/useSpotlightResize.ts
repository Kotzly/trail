import { useCallback, useEffect, useRef, useState } from 'react';
import { spotlightSplitRatioItem } from '@shared/config/storage-items.js';

const MIN_RATIO = 0;
const MAX_RATIO = 1;
const NARROW_BREAKPOINT = 920;
const SNAP_POINTS = [0, 0.3, 0.5, 0.7, 1.0] as const;
const SNAP_THRESHOLD = 0.04;
const HANDLE_PX = 10;
const DEFAULT_RATIO = 0.38;

/** Minimum panel sizes in pixels to prevent unreadable content */
const MIN_LEFT_PX = 250;
const MIN_RIGHT_PX = 300;

function loadRatioSync(): number {
  return DEFAULT_RATIO; // default, async load overwrites immediately
}

function snapToNearest(ratio: number): number {
  for (const snap of SNAP_POINTS) {
    if (Math.abs(ratio - snap) < SNAP_THRESHOLD) return snap;
  }
  return ratio;
}

/** Clamp ratio so neither panel goes below its minimum pixel width */
function clampToMinWidths(ratio: number, containerPx: number): number {
  if (containerPx <= 0) return ratio;
  const available = containerPx - HANDLE_PX;
  if (available <= 0) return ratio;

  // Only clamp mid-range ratios; 0 and 1 are valid collapsed states
  if (ratio <= 0) return 0;
  if (ratio >= 1) return 1;

  const minLeftRatio = MIN_LEFT_PX / available;
  const maxLeftRatio = 1 - MIN_RIGHT_PX / available;

  // If container is too small for both minimums, let ratio pass through
  if (minLeftRatio >= maxLeftRatio) return ratio;

  return Math.min(maxLeftRatio, Math.max(minLeftRatio, ratio));
}

/** Find the next snap point in the given direction (+1 or -1) */
function nextSnapPoint(current: number, direction: 1 | -1): number {
  const epsilon = 0.01;
  if (direction === 1) {
    for (const snap of SNAP_POINTS) {
      if (snap > current + epsilon) return snap;
    }
    return SNAP_POINTS[SNAP_POINTS.length - 1] ?? 1;
  }
  for (let i = SNAP_POINTS.length - 1; i >= 0; i--) {
    const snap = SNAP_POINTS[i];
    if (snap !== undefined && snap < current - epsilon) return snap;
  }
  return SNAP_POINTS[0] ?? 0;
}

export function useSpotlightResize(containerRef: React.RefObject<HTMLElement | null>) {
  const [splitRatio, setSplitRatio] = useState(loadRatioSync);
  const [isDragging, setIsDragging] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const startPosRef = useRef(0);
  const startRatioRef = useRef(0);
  const dragNarrowRef = useRef(false);
  const prevRatioRef = useRef(DEFAULT_RATIO);

  // Load persisted ratio on mount (storage may be unavailable in content script)
  useEffect(() => {
    void spotlightSplitRatioItem.getValue().then((stored) => {
      if (stored >= MIN_RATIO && stored <= MAX_RATIO) {
        setSplitRatio(stored);
      }
    }).catch(() => {});
  }, []);

  // Detect narrow viewport
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < NARROW_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Track isNarrow in a ref for the drag handler
  const isNarrowRef = useRef(isNarrow);
  isNarrowRef.current = isNarrow;

  /** Set ratio with smooth CSS transition (for programmatic changes) */
  const setSplitRatioAnimated = useCallback((ratio: number) => {
    // Remember previous non-collapsed ratio for expand-from-collapsed
    const currentRatio = splitRatioRef.current;
    if (currentRatio > 0 && currentRatio < 1) {
      prevRatioRef.current = currentRatio;
    }
    setIsAnimating(true);
    setSplitRatio(ratio);
    void spotlightSplitRatioItem.setValue(ratio).catch(() => {});
    // Clear animation flag after transition completes
    const timer = setTimeout(() => setIsAnimating(false), 220);
    return () => clearTimeout(timer);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const narrow = isNarrowRef.current;
    dragNarrowRef.current = narrow;
    startPosRef.current = narrow ? e.clientY : e.clientX;
    startRatioRef.current = splitRatio;
    setIsAnimating(false);
    setIsDragging(true);
  }, [splitRatio]);

  /** Double-click resets to default ratio */
  const handleDoubleClick = useCallback(() => {
    setSplitRatioAnimated(DEFAULT_RATIO);
  }, [setSplitRatioAnimated]);

  /** Click on handle when a panel is collapsed → expand to previous or default */
  const handleClick = useCallback(() => {
    if (splitRatio !== 0 && splitRatio !== 1) return;
    const target = prevRatioRef.current > 0 && prevRatioRef.current < 1
      ? prevRatioRef.current
      : DEFAULT_RATIO;
    setSplitRatioAnimated(target);
  }, [splitRatio, setSplitRatioAnimated]);

  /** Step to next/previous snap point (for keyboard control) */
  const stepSnapPoint = useCallback((direction: 1 | -1) => {
    const target = nextSnapPoint(splitRatioRef.current, direction);
    setSplitRatioAnimated(target);
  }, [setSplitRatioAnimated]);

  /** Toggle graph panel visibility (for keyboard shortcut) */
  const toggleGraphPanel = useCallback(() => {
    const current = splitRatioRef.current;
    // If graph is showing (ratio between 0 exclusive and 1 exclusive), collapse to show list only
    // If graph is hidden (ratio = 1) or list is hidden (ratio = 0), restore
    if (current > 0 && current < 1) {
      // Hide graph (expand list to full)
      setSplitRatioAnimated(1);
    } else {
      // Restore to previous or default
      const target = prevRatioRef.current > 0 && prevRatioRef.current < 1
        ? prevRatioRef.current
        : DEFAULT_RATIO;
      setSplitRatioAnimated(target);
    }
  }, [setSplitRatioAnimated]);

  const splitRatioRef = useRef(splitRatio);
  splitRatioRef.current = splitRatio;
  const wasDraggingRef = useRef(false);

  useEffect(() => {
    if (!isDragging) return;
    const narrow = dragNarrowRef.current;
    const cursor = narrow ? 'row-resize' : 'col-resize';

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const size = narrow ? rect.height : rect.width;
      if (size === 0) return;
      const pos = narrow ? e.clientY : e.clientX;
      const delta = pos - startPosRef.current;
      const raw = Math.min(MAX_RATIO, Math.max(MIN_RATIO, startRatioRef.current + delta / size));
      const snapped = snapToNearest(raw);
      // Apply min-width constraints (skip if snapped to collapsed 0 or 1)
      const clamped = snapped === 0 || snapped === 1
        ? snapped
        : clampToMinWidths(snapped, size);
      setSplitRatio(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      wasDraggingRef.current = true;
      requestAnimationFrame(() => { wasDraggingRef.current = false; });
      // Remember non-collapsed ratio before persisting
      const final = splitRatioRef.current;
      if (final > 0 && final < 1) {
        prevRatioRef.current = final;
      }
      void spotlightSplitRatioItem.setValue(final).catch(() => {});
    };

    // Force cursor on both the page body (for areas outside Shadow DOM)
    // and the shadow host (for areas inside — `:host { all: initial }`
    // blocks inheritance from the page).
    const rootNode = containerRef.current?.getRootNode();
    const shadowHost = rootNode instanceof ShadowRoot
      ? (rootNode.host as HTMLElement)
      : null;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = cursor;
    document.body.style.userSelect = 'none';
    if (shadowHost) {
      shadowHost.style.cursor = cursor;
      shadowHost.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (shadowHost) {
        shadowHost.style.cursor = '';
        shadowHost.style.userSelect = '';
      }
    };
  }, [isDragging, containerRef]);

  const draggingStyle = isDragging ? { pointerEvents: 'none' as const } : undefined;

  // Build styles for horizontal (wide) mode
  const buildHorizontal = () => {
    const leftStyle: React.CSSProperties =
      splitRatio === 0
        ? { width: 0, flex: 'none', overflow: 'hidden', ...draggingStyle }
        : splitRatio === 1
          ? { width: `calc(100% - ${HANDLE_PX}px)`, flex: 'none', ...draggingStyle }
          : { width: `${splitRatio * 100}%`, flex: 'none', ...draggingStyle };

    const rightStyle: React.CSSProperties =
      splitRatio === 1
        ? { flex: 'none', width: 0, overflow: 'hidden', ...draggingStyle }
        : splitRatio === 0
          ? { flex: 1, ...draggingStyle }
          : { flex: 1, ...draggingStyle };

    return { leftStyle, rightStyle };
  };

  // Build styles for vertical (narrow) mode
  const buildVertical = () => {
    const leftStyle: React.CSSProperties =
      splitRatio === 0
        ? { height: 0, flex: 'none', overflow: 'hidden', width: '100%', ...draggingStyle }
        : splitRatio === 1
          ? { height: `calc(100% - ${HANDLE_PX}px)`, flex: 'none', width: '100%', ...draggingStyle }
          : { height: `${splitRatio * 100}%`, flex: 'none', width: '100%', ...draggingStyle };

    const rightStyle: React.CSSProperties =
      splitRatio === 1
        ? { flex: 'none', height: 0, overflow: 'hidden', ...draggingStyle }
        : { flex: 1, ...draggingStyle };

    return { leftStyle, rightStyle };
  };

  const styles = isNarrow ? buildVertical() : buildHorizontal();

  return {
    splitRatio,
    isDragging,
    isAnimating,
    wasDragging: wasDraggingRef,
    handleMouseDown,
    handleDoubleClick,
    handleClick,
    stepSnapPoint,
    toggleGraphPanel,
    isNarrow,
    leftStyle: styles.leftStyle,
    rightStyle: styles.rightStyle,
  };
}
