import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpotlightMode } from './types.js';

const MIN_RATIO = 0.3;
const MAX_RATIO = 0.7;
const STORAGE_KEY = 'spotlight-split-ratio';
const NARROW_BREAKPOINT = 800;
const ANIMATE_THRESHOLD = 0.05;
const ANIMATE_STEP_MS = 16;
const ANIMATE_SPEED = 0.15;

const MODE_RATIOS: Record<SpotlightMode, number> = {
  discover: 0.36,
  search: 0.45,
  commands: 1.0,
};

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

export function useSpotlightResize(
  containerRef: React.RefObject<HTMLElement | null>,
  mode: SpotlightMode = 'discover',
) {
  const [splitRatio, setSplitRatio] = useState(loadRatio);
  const [isDragging, setIsDragging] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const startXRef = useRef(0);
  const startRatioRef = useRef(0);
  const userDraggedRef = useRef(false);
  const splitRatioRef = useRef(splitRatio);
  splitRatioRef.current = splitRatio;
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect narrow viewport
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < NARROW_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const setSplitRatioAnimated = useCallback((target: number) => {
    if (animationRef.current !== null) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }
    const clampedTarget = Math.min(MAX_RATIO, Math.max(MIN_RATIO, target));
    animationRef.current = setInterval(() => {
      const current = splitRatioRef.current;
      const diff = clampedTarget - current;
      if (Math.abs(diff) < 0.005) {
        setSplitRatio(clampedTarget);
        if (animationRef.current !== null) {
          clearInterval(animationRef.current);
          animationRef.current = null;
        }
        return;
      }
      setSplitRatio(current + diff * ANIMATE_SPEED);
    }, ANIMATE_STEP_MS);
  }, []);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        clearInterval(animationRef.current);
      }
    };
  }, []);

  // When mode changes and user hasn't manually dragged, animate to mode default
  // Skip for commands mode — effectiveRatio overrides to 1.0 directly
  useEffect(() => {
    if (userDraggedRef.current || mode === 'commands') return;
    const target = MODE_RATIOS[mode] ?? MODE_RATIOS.discover;
    if (Math.abs(splitRatioRef.current - target) > ANIMATE_THRESHOLD) {
      setSplitRatioAnimated(target);
    }
  }, [mode, setSplitRatioAnimated]);

  // Reset userDragged when mode returns to discover
  useEffect(() => {
    if (mode === 'discover') {
      userDraggedRef.current = false;
    }
  }, [mode]);

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
      userDraggedRef.current = true;
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

  const effectiveRatio = mode === 'commands' ? 1.0 : splitRatio;

  return {
    splitRatio: isNarrow ? null : effectiveRatio,
    isDragging,
    handleMouseDown,
    leftStyle: isNarrow ? undefined : { width: `${effectiveRatio * 100}%`, flex: 'none' as const },
    rightStyle: isNarrow
      ? undefined
      : mode === 'commands'
        ? { flex: 0, width: 0, overflow: 'hidden' as const, pointerEvents: 'none' as const }
        : { flex: 1, pointerEvents: isDragging ? 'none' as const : 'auto' as const },
  };
}
