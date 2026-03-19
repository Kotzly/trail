import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { NodeId } from "@shared/types/ids.js";
import type { NodePosition } from "../../graph/types.js";
import type { GraphPixiRenderer } from "../../graph/render/GraphPixiRenderer.js";
import type { SelectionBox } from "./graph-canvas-types.js";
import { buildPreviewSelection, shouldEmitPreview } from "./selection-utils.js";

const SELECTION_PREVIEW_MS = 40;

type UseGraphSelectionParams = {
  rendererRef: RefObject<GraphPixiRenderer | null>;
  positionsRef: RefObject<Map<NodeId, NodePosition>>;
  onSelectedNodeIdsChange: (ids: Set<NodeId>) => void;
  onClearSelection: () => void;
};

export function useGraphSelection({
  rendererRef,
  positionsRef,
  onSelectedNodeIdsChange,
  onClearSelection,
}: UseGraphSelectionParams) {
  const selectionBoxRef = useRef<HTMLDivElement | null>(null);
  const previewSelectionRef = useRef<Set<NodeId>>(new Set());
  const selectionWorldRectRef = useRef<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null>(null);
  const selectionComputeHandleRef = useRef<number | null>(null);
  const selectionComputeDirtyRef = useRef(false);
  const selectionPreviewLastRunRef = useRef(0);
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const baseSelectionRef = useRef<Set<NodeId>>(new Set());
  const selectionModeRef = useRef<"replace" | "add" | "remove">("replace");
  const selectionDragRef = useRef(false);

  const cancelSelectionCompute = useCallback(() => {
    const handle = selectionComputeHandleRef.current;
    if (handle === null) return;
    window.clearTimeout(handle);
    selectionComputeHandleRef.current = null;
    selectionComputeDirtyRef.current = false;
  }, []);

  useEffect(() => {
    return () => cancelSelectionCompute();
  }, [cancelSelectionCompute]);

  const hideSelectionBox = useCallback(() => {
    const box = selectionBoxRef.current;
    if (!box) return;
    box.style.opacity = "0";
    box.style.width = "0px";
    box.style.height = "0px";
  }, []);

  const updateSelectionBox = useCallback((boxState: SelectionBox) => {
    const box = selectionBoxRef.current;
    if (!box) return;
    box.style.opacity = "1";
    box.style.left = `${boxState.left}px`;
    box.style.top = `${boxState.top}px`;
    box.style.width = `${boxState.width}px`;
    box.style.height = `${boxState.height}px`;
  }, []);

  const computeSelectionPreview = useCallback(() => {
    if (!isSelectingRef.current) return;
    const renderer = rendererRef.current;
    const rect = selectionWorldRectRef.current;
    if (!renderer || !rect) return;
    const hits = renderer.queryVisibleNodesInWorldRect(rect);
    const preview = buildPreviewSelection(
      baseSelectionRef.current,
      hits,
      selectionModeRef.current,
      positionsRef.current,
    );
    if (shouldEmitPreview(previewSelectionRef.current, preview)) {
      previewSelectionRef.current = preview;
      renderer.setSelectionPreview(preview);
    }
  }, [rendererRef, positionsRef]);

  const scheduleSelectionPreview = useCallback(() => {
    if (selectionComputeHandleRef.current !== null) {
      selectionComputeDirtyRef.current = true;
      return;
    }
    const now = performance.now();
    const elapsed = now - selectionPreviewLastRunRef.current;
    const delay = Math.max(0, SELECTION_PREVIEW_MS - elapsed);
    const run = () => {
      selectionComputeHandleRef.current = null;
      if (!isSelectingRef.current) return;
      selectionPreviewLastRunRef.current = performance.now();
      computeSelectionPreview();
      if (selectionComputeDirtyRef.current) {
        selectionComputeDirtyRef.current = false;
        scheduleSelectionPreview(); // eslint-disable-line react-hooks/immutability -- intentional recursive scheduling
      }
    };
    selectionComputeHandleRef.current = window.setTimeout(run, delay);
  }, [computeSelectionPreview]);

  const finalizeSelection = useCallback(() => {
    if (!isSelectingRef.current) return;
    cancelSelectionCompute();
    if (selectionDragRef.current && selectionWorldRectRef.current) {
      const renderer = rendererRef.current;
      const rect = selectionWorldRectRef.current;
      if (renderer && rect) {
        const hits = renderer.queryNodesInWorldRect(rect);
        const preview = buildPreviewSelection(
          baseSelectionRef.current,
          hits,
          selectionModeRef.current,
          positionsRef.current,
        );
        previewSelectionRef.current = preview;
      }
    }
    isSelectingRef.current = false;
    const finalSelection = new Set(previewSelectionRef.current);
    const renderer = rendererRef.current;
    renderer?.clearSelectionPreview();
    renderer?.setSelectedNodeIds(finalSelection);
    onSelectedNodeIdsChange(finalSelection);
    hideSelectionBox();
    previewSelectionRef.current = new Set();
    selectionWorldRectRef.current = null;
  }, [
    cancelSelectionCompute,
    hideSelectionBox,
    onSelectedNodeIdsChange,
    rendererRef,
    positionsRef,
  ]);

  const clearSelectionState = useCallback(() => {
    cancelSelectionCompute();
    isSelectingRef.current = false;
    selectionDragRef.current = false;
    previewSelectionRef.current = new Set();
    selectionWorldRectRef.current = null;
    rendererRef.current?.clearSelectionPreview();
    rendererRef.current?.setSelectedNodeIds(new Set());
    onClearSelection();
    hideSelectionBox();
  }, [cancelSelectionCompute, hideSelectionBox, onClearSelection, rendererRef]);

  return {
    selectionBoxRef,
    isSelectingRef,
    selectionStartRef,
    baseSelectionRef,
    selectionModeRef,
    selectionDragRef,
    selectionWorldRectRef,
    previewSelectionRef,
    updateSelectionBox,
    hideSelectionBox,
    scheduleSelectionPreview,
    finalizeSelection,
    clearSelectionState,
  };
}
