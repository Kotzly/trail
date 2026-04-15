import type { LayoutSettings } from "../types/settings.js";

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  mode: "tree",
  tree: {
    verticalGapScale: 1,
    horizontalGapScale: 1,
    hideRoot: false,
  },
  mindmap: {
    verticalGapScale: 1,
    horizontalGapScale: 1,
  },
};
