/**
 * Zoom-based Level-of-Detail selectors for the graph.
 *
 * Each selector returns a boolean so useStore only re-renders
 * when the value flips, not on every zoom tick.
 *
 * Edges require handles in the DOM, so showEdges is tied to
 * showLabels — the lowest LOD that renders handles.
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
