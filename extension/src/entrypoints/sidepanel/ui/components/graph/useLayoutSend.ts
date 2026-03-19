import { useCallback, useEffect, useRef } from "react";
import { setNodeLayoutBatch } from "../../../api/tree.js";
import type { LayoutUpdateMap } from "./graph-canvas-types.js";

const LAYOUT_UPDATE_MS = 80;

/**
 * Throttled layout update sender. Queues layout offset changes and
 * flushes them to the background at most every LAYOUT_UPDATE_MS.
 */
export function useLayoutSend() {
  const layoutSendRef = useRef<{
    lastSent: number;
    timer: number | null;
    pending: LayoutUpdateMap | null;
  }>({ lastSent: 0, timer: null, pending: null });

  const flushLayoutUpdates = useCallback(async (updates: LayoutUpdateMap) => {
    try {
      await setNodeLayoutBatch(
        Array.from(updates.entries()).map(([nodeId, layout]) => ({
          nodeId,
          ...layout,
        })),
      );
    } catch (error) {
      console.error("Failed to save node position:", error);
    }
  }, []);

  const queueLayoutUpdates = useCallback(
    (updates: LayoutUpdateMap, immediate = false) => {
      if (updates.size === 0) return;
      const state = layoutSendRef.current;
      if (!state.pending) {
        state.pending = new Map();
      }
      updates.forEach((layout, nodeId) => {
        state.pending?.set(nodeId, layout);
      });
      const now = performance.now();
      const elapsed = now - state.lastSent;
      const canSendNow = immediate || elapsed >= LAYOUT_UPDATE_MS;
      if (canSendNow) {
        if (state.timer !== null) {
          window.clearTimeout(state.timer);
          state.timer = null;
        }
        state.lastSent = now;
        const next = state.pending;
        state.pending = null;
        if (next) void flushLayoutUpdates(next);
        return;
      }
      if (state.timer !== null) return;
      const delay = Math.max(0, LAYOUT_UPDATE_MS - elapsed);
      state.timer = window.setTimeout(() => {
        state.timer = null;
        const next = state.pending;
        state.pending = null;
        if (!next) return;
        state.lastSent = performance.now();
        void flushLayoutUpdates(next);
      }, delay);
    },
    [flushLayoutUpdates],
  );

  // Flush pending updates on unmount instead of discarding
  useEffect(() => {
    return () => {
      const state = layoutSendRef.current;
      if (state.timer !== null) {
        window.clearTimeout(state.timer);
        state.timer = null;
      }
      const pending = state.pending;
      state.pending = null;
      if (pending) {
        void flushLayoutUpdates(pending);
      }
    };
  }, [flushLayoutUpdates]);

  return { layoutSendRef, flushLayoutUpdates, queueLayoutUpdates };
}
