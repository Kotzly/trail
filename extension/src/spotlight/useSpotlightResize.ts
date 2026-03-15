import { useCallback, useEffect, useRef, useState } from 'react';
import { spotlightSplitRatioItem } from '@shared/config/storage-items.js';

const MIN_RATIO = 0;
const MAX_RATIO = 1;
const NARROW_BREAKPOINT = 920;
const SNAP_POINTS = [0, 0.3, 0.5, 0.7, 1.0] as const;
const SNAP_THRESHOLD = 0.04;
const HANDLE_PX = 6;

function loadRatioSync(): number {
  return 0.38; // default, async load overwrites immediately
}

function snapToNearest(ratio: number): number {
  for (const snap of SNAP_POINTS) {
    if (Math.abs(ratio - snap) < SNAP_THRESHOLD) return snap;
  }
  return ratio;
}

export function useSpotlightResize(containerRef: React.RefObject<HTMLElement | null>) {
  const [splitRatio, setSplitRatio] = useState(loadRatioSync);
  const [isDragging, setIsDragging] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const startPosRef = useRef(0);
  const startRatioRef = useRef(0);
  const dragNarrowRef = useRef(false);

  // Load persisted ratio on mount
  useEffect(() => {
    void spotlightSplitRatioItem.getValue().then((stored) => {
      if (stored >= MIN_RATIO && stored <= MAX_RATIO) {
        setSplitRatio(stored);
      }
    });
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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const narrow = isNarrowRef.current;
    dragNarrowRef.current = narrow;
    startPosRef.current = narrow ? e.clientY : e.clientX;
    startRatioRef.current = splitRatio;
    setIsDragging(true);
  }, [splitRatio]);

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
      setSplitRatio(snapToNearest(raw));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      wasDraggingRef.current = true;
      requestAnimationFrame(() => { wasDraggingRef.current = false; });
      void spotlightSplitRatioItem.setValue(splitRatioRef.current);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = cursor;
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
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
    wasDragging: wasDraggingRef,
    handleMouseDown,
    isNarrow,
    leftStyle: styles.leftStyle,
    rightStyle: styles.rightStyle,
  };
}
