/**
 * Zoom-based Level-of-Detail selectors for the graph.
 *
 * Each selector returns a boolean so useStore only re-renders
 * when the value flips, not on every zoom tick.
 *
 * Edges require handles in the DOM, so showEdges is tied to
 * showLabels — the lowest LOD that renders handles.
 *
 * A tri-state `Lod` selector is also exposed for effects that want to
 * gate purely in CSS (see `LodController`): the container receives a
 * `data-lod="far" | "mid" | "near"` attribute that descendants can
 * target without subscribing to the store.
 */
import type { ReactFlowState } from "@xyflow/react";

// LOD thresholds (zoom level)
const ZOOM_LABELS = 0.15; // minimal node chrome + handles
const ZOOM_DETAIL = 0.4; // full node: favicon, URL, badges
const ZOOM_BACKGROUND = 0.15; // dot grid

/** Labels + handles visible — also the minimum for edge rendering */
export const selectShowLabels = (s: ReactFlowState) => s.transform[2] >= ZOOM_LABELS;

/** Edges require handles → same threshold as labels */
export const selectShowEdges = selectShowLabels;

/** Full node detail: favicon, description, badges */
export const selectShowDetail = (s: ReactFlowState) => s.transform[2] >= ZOOM_DETAIL;

/** Background dot grid */
export const selectShowBackground = (s: ReactFlowState) => s.transform[2] >= ZOOM_BACKGROUND;

export type Lod = "far" | "mid" | "near";

/**
 * Tri-state LOD bucket for CSS-driven effects. Only flips when the
 * zoom crosses a threshold — callers using this selector re-render at
 * most twice per zoom gesture, never per frame.
 */
export const selectLod = (s: ReactFlowState): Lod => {
  const zoom = s.transform[2];
  if (zoom < ZOOM_LABELS) return "far";
  if (zoom < ZOOM_DETAIL) return "mid";
  return "near";
};
