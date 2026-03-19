import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";

export type IndicatorPosition = { top: number; height: number } | null;

/**
 * Computes the position of the animated selection indicator relative to the
 * scrollable list container.
 *
 * Instead of observing every DOM mutation (`MutationObserver` on the whole
 * subtree), we rely on React's render cycle:
 *   - `selectedKey` changes → immediate re-measure
 *   - `layoutSignal` changes (sections collapse/expand, item count) → re-measure
 *   - scroll → passive listener re-measure
 *
 * A `ResizeObserver` on the currently selected element covers edge cases where
 * an item's size changes without the key or layout signal changing.
 */
export function useSelectionIndicator(
  listRef: RefObject<HTMLElement | null>,
  selectedKey: string | null,
  layoutSignal?: string,
): IndicatorPosition {
  const [pos, setPos] = useState<IndicatorPosition>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const measure = useCallback(() => {
    if (!selectedKey || !listRef.current) {
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

    setPos({
      top: selectedRect.top - containerRect.top + container.scrollTop,
      height: selectedRect.height,
    });
  }, [listRef, selectedKey]);

  useLayoutEffect(() => {
    if (!selectedKey || !listRef.current) {
      setPos(null);
      return;
    }

    // Synchronous measure, then a deferred re-measure (cmdk may update
    // data-selected after our layout effect runs).
    measure();
    const raf = requestAnimationFrame(measure);

    const container = listRef.current;
    container.addEventListener("scroll", measure, { passive: true });

    // Observe selected element for size changes
    const selected = container.querySelector('[data-selected="true"]') as HTMLElement | null;
    if (selected) {
      resizeObserverRef.current?.disconnect();
      const observer = new ResizeObserver(measure);
      observer.observe(selected);
      resizeObserverRef.current = observer;
    }

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener("scroll", measure);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, [measure, listRef, selectedKey, layoutSignal]);

  return pos;
}
