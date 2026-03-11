import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';

type IndicatorPosition = { top: number; height: number } | null;

export function useSelectionIndicator(
  listRef: RefObject<HTMLElement | null>,
  selectedKey: string | null,
): IndicatorPosition {
  const [pos, setPos] = useState<IndicatorPosition>(null);

  const measure = useCallback(() => {
    if (!selectedKey || !listRef.current) {
      setPos(null);
      return;
    }

    const container = listRef.current;
    const selected = container.querySelector('[data-selected="true"]') as HTMLElement | null;
    if (!selected) {
      setPos(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();

    setPos({
      top: selectedRect.top - containerRect.top + container.scrollTop,
      height: selectedRect.height,
    });
  }, [selectedKey, listRef]);

  useLayoutEffect(() => {
    measure();

    const container = listRef.current;
    if (!container) return;

    container.addEventListener('scroll', measure, { passive: true });
    return () => container.removeEventListener('scroll', measure);
  }, [measure, listRef]);

  return pos;
}
