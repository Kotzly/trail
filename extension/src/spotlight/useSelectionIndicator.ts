import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

export type IndicatorPosition = { top: number; height: number } | null;

export function useSelectionIndicator(
  listRef: RefObject<HTMLElement | null>,
  selectedKey: string | null,
): IndicatorPosition {
  const [pos, setPos] = useState<IndicatorPosition>(null);
  const lastPos = useRef<IndicatorPosition>(null);
  const selectedKeyRef = useRef(selectedKey);
  selectedKeyRef.current = selectedKey;

  const measure = useCallback(() => {
    if (!selectedKeyRef.current || !listRef.current) {
      lastPos.current = null;
      setPos(null);
      return;
    }

    const container = listRef.current;
    const selected = container.querySelector('[data-selected="true"]') as HTMLElement | null;
    if (!selected) {
      // Keep last known position so the indicator stays mounted during transitions
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();

    const next = {
      top: selectedRect.top - containerRect.top + container.scrollTop,
      height: selectedRect.height,
    };
    lastPos.current = next;
    setPos(next);
  }, [listRef]);

  useLayoutEffect(() => {
    measure();
    // Deferred re-measure: cmdk may update data-selected after our layout effect
    const raf = requestAnimationFrame(measure);

    const container = listRef.current;
    if (!container) return () => cancelAnimationFrame(raf);

    container.addEventListener('scroll', measure, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener('scroll', measure);
    };
  }, [measure, listRef, selectedKey]);

  // Re-measure when list DOM changes (e.g. section expand/collapse shifts items)
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const observer = new MutationObserver(() => {
      requestAnimationFrame(measure);
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [measure, listRef]);

  return pos;
}
