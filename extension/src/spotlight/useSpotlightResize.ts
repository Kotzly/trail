import { useCallback, useEffect, useRef, useState } from 'react';
import { spotlightSplitRatioItem } from '@shared/config/storage-items.js';

const MIN_RATIO = 0.3;
const MAX_RATIO = 0.7;
const NARROW_BREAKPOINT = 800;

function loadRatioSync(): number {
  return 0.38; // default, async load overwrites immediately
}

export function useSpotlightResize(containerRef: React.RefObject<HTMLElement | null>) {
  const [splitRatio, setSplitRatio] = useState(loadRatioSync);
  const [isDragging, setIsDragging] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const startXRef = useRef(0);
  const startRatioRef = useRef(0);

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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isNarrow) return;
    e.preventDefault();
    startXRef.current = e.clientX;
    startRatioRef.current = splitRatio;
    setIsDragging(true);
  }, [splitRatio, isNarrow]);

  const splitRatioRef = useRef(splitRatio);
  splitRatioRef.current = splitRatio;

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const containerWidth = container.getBoundingClientRect().width;
      if (containerWidth === 0) return;
      const delta = e.clientX - startXRef.current;
      const newRatio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, startRatioRef.current + delta / containerWidth));
      setSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      void spotlightSplitRatioItem.setValue(splitRatioRef.current);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, containerRef]);

  return {
    splitRatio: isNarrow ? null : splitRatio,
    isDragging,
    handleMouseDown,
    leftStyle: isNarrow ? undefined : { width: `${splitRatio * 100}%`, flex: 'none' as const, ...(isDragging && { pointerEvents: 'none' as const }) },
    rightStyle: isNarrow ? undefined : { flex: 1, ...(isDragging && { pointerEvents: 'none' as const }) },
  };
}
