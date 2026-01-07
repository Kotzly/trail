import type { LayoutConfig } from '../types';

// Layout constants - VERTICAL orientation (top to bottom)
// Normal mode
export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 60;
export const VERTICAL_GAP = 60;   // Gap between parent and children (Y direction)
export const HORIZONTAL_GAP = 24; // Gap between sibling nodes (X direction)
export const ROOT_GAP = 60;       // Gap between separate trees (forest)
export const PADDING = 40;

// Compact mode
export const COMPACT_NODE_WIDTH = 100;
export const COMPACT_NODE_HEIGHT = 40;
export const COMPACT_VERTICAL_GAP = 40;
export const COMPACT_HORIZONTAL_GAP = 12;
export const COMPACT_ROOT_GAP = 40;

// Current layout config (set by render based on compactGraph setting)
let layoutConfig: LayoutConfig = {
  nodeWidth: NODE_WIDTH,
  nodeHeight: NODE_HEIGHT,
  verticalGap: VERTICAL_GAP,
  horizontalGap: HORIZONTAL_GAP,
  rootGap: ROOT_GAP,
  compact: false
};

export function getLayoutConfig(): LayoutConfig {
  return layoutConfig;
}

export function setLayoutConfig(config: LayoutConfig): void {
  layoutConfig = config;
}

