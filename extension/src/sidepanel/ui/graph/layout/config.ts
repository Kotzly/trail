import type { LayoutConfig } from '../types.js';

// Layout constants - VERTICAL orientation (top to bottom)
// Normal mode
export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 60;
export const VERTICAL_GAP = 60;   // Gap between parent and children (Y direction)
export const HORIZONTAL_GAP = 24; // Gap between sibling nodes (X direction)
export const PADDING = 40;



// Current layout config (set by render based on compactGraph setting)
let layoutConfig: LayoutConfig = {
  nodeWidth: NODE_WIDTH,
  nodeHeight: NODE_HEIGHT,
  verticalGap: VERTICAL_GAP,
  horizontalGap: HORIZONTAL_GAP,
};

export function getLayoutConfig(): LayoutConfig {
  return layoutConfig;
}

export function setLayoutConfig(config: LayoutConfig): void {
  layoutConfig = config;
}

