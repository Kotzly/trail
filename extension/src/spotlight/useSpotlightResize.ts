import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_RATIO = 0.3;
const MAX_RATIO = 0.7;
const STORAGE_KEY = 'spotlight-split-ratio';
const NARROW_BREAKPOINT = 800;

function loadRatio(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!Number.isNaN(parsed) && parsed >= MIN_RATIO && parsed <= MAX_RATIO) return parsed;
    }
  } catch { /* ignore */ }
  return 0.38; // default: left panel ~38%
}

export function useSpotlightResize(containerRef: React.RefObject<HTMLElement | null>) {
  const [splitRatio, setSplitRatio] = useState(loadRatio);
  const [isDragging, setIsDragging] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const startXRef = useRef(0);
  const startRatioRef = useRef(0);

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
      try { localStorage.setItem(STORAGE_KEY, splitRatio.toString()); } catch { /* ignore */ }
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
  }, [isDragging, containerRef, splitRatio]);

  return {
    splitRatio: isNarrow ? null : splitRatio,
    isDragging,
    handleMouseDown,
    leftStyle: isNarrow ? undefined : { width: `${splitRatio * 100}%`, flex: 'none' as const },
    rightStyle: isNarrow ? undefined : { flex: 1, pointerEvents: isDragging ? 'none' as const : 'auto' as const },
  };
}
