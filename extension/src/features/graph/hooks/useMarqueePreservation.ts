import { useCallback, useEffect, useRef } from "react";
import { useLatest } from "@ui/hooks/use-latest";
import type { NodeId } from "@shared/types/ids.js";
import type { TrailNode as TrailNodeType } from "../types.js";

type UseMarqueePreservationInput = {
  selectedNodeIds: Set<NodeId>;
  onSelectionChange: (nodeIds: Set<NodeId>) => void;
};

type UseMarqueePreservationResult = {
  onContainerPointerDown: (event: React.PointerEvent) => void;
  onContainerPointerUp: () => void;
  onSelectionStart: () => void;
  onSelectionEnd: () => void;
  onSelectionChange: (params: { nodes: TrailNodeType[] }) => void;
};

/**
 * Marquee + multi-selection preservation.
 *
 * ReactFlow unconditionally clears selection at the start of a marquee
 * drag (xyflow `resetSelectedElements` runs regardless of multi-select
 * key), which breaks "hold modifier + drag to change selection". We
 * capture the pre-drag selection on pointerdown and merge the marquee
 * result into it per the mode chosen at pointerdown:
 *   • add (Shift/Meta/Ctrl) — unions the rect with preserved
 *   • subtract (Alt/Option) — removes rect from preserved
 *
 * Escape clears the selection from anywhere; the keydown listener is
 * mounted only while there's a non-empty selection.
 */
export function useMarqueePreservation(
  input: UseMarqueePreservationInput,
): UseMarqueePreservationResult {
  const { selectedNodeIds, onSelectionChange } = input;

  const preservedSelection = useRef<Set<NodeId> | null>(null);
  const selectionMode = useRef<"add" | "subtract" | null>(null);
  const marqueeActive = useRef(false);
  const justReset = useRef(false);
  const selectedIdsLatest = useLatest(selectedNodeIds);

  const onContainerPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      const mode: "add" | "subtract" | null = event.altKey
        ? "subtract"
        : event.shiftKey || event.metaKey || event.ctrlKey
          ? "add"
          : null;
      if (mode) {
        preservedSelection.current = new Set(selectedIdsLatest.current);
        selectionMode.current = mode;
        justReset.current = true;
      } else {
        preservedSelection.current = null;
        selectionMode.current = null;
        justReset.current = false;
      }
    },
    [selectedIdsLatest],
  );

  const onContainerPointerUp = useCallback(() => {
    if (!marqueeActive.current) {
      preservedSelection.current = null;
      selectionMode.current = null;
      justReset.current = false;
    }
  }, []);

  const onSelectionStart = useCallback(() => {
    marqueeActive.current = true;
  }, []);

  const onSelectionEnd = useCallback(() => {
    marqueeActive.current = false;
    preservedSelection.current = null;
    selectionMode.current = null;
    justReset.current = false;
  }, []);

  // Sync ReactFlow selection → store
  const handleSelectionChange = useCallback(
    ({ nodes }: { nodes: TrailNodeType[] }) => {
      const rect = new Set<NodeId>(nodes.map((n) => n.data.nodeId));
      const preserved = preservedSelection.current;
      const mode = selectionMode.current;

      if (!preserved || !mode) {
        onSelectionChange(rect);
        return;
      }

      if (!marqueeActive.current) {
        if (rect.size === 0 && justReset.current) {
          // xyflow's reset at marquee start fired before onSelectionStart.
          // Restore pre-drag selection so there's no empty flash.
          justReset.current = false;
          onSelectionChange(new Set(preserved));
          return;
        }
        // Non-empty without marquee → click path (handled by xyflow).
        justReset.current = false;
        onSelectionChange(rect);
        return;
      }

      const merged = new Set(preserved);
      if (mode === "add") {
        for (const id of rect) merged.add(id);
      } else {
        for (const id of rect) merged.delete(id);
      }
      onSelectionChange(merged);
    },
    [onSelectionChange],
  );

  // Escape mirrors the empty-pane click gesture for keyboard users.
  // Mounted only when there's a non-empty selection so we don't add a
  // global listener that fires for every Escape press.
  useEffect(() => {
    if (selectedNodeIds.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        preservedSelection.current = null;
        selectionMode.current = null;
        marqueeActive.current = false;
        justReset.current = false;
        onSelectionChange(new Set());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNodeIds, onSelectionChange]);

  return {
    onContainerPointerDown,
    onContainerPointerUp,
    onSelectionStart,
    onSelectionEnd,
    onSelectionChange: handleSelectionChange,
  };
}
