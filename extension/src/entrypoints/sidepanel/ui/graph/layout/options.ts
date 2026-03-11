import type { Settings } from '@shared/types/settings.js';
import { DEFAULT_LAYOUT_SETTINGS } from '@shared/layout/defaults.js';
import type { LayoutConfig, RadialLayoutConfig } from '../types.js';
import { HORIZONTAL_GAP, NODE_HEIGHT, NODE_WIDTH, VERTICAL_GAP } from './config.js';

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;

type LayoutOptions = {
  mode: Settings['layout']['mode'];
  tree: LayoutConfig;
  mindmap: LayoutConfig;
  radial: RadialLayoutConfig;
};

export function deriveLayoutOptions(settings: Settings | null | undefined): LayoutOptions {
  const layout = settings?.layout ?? DEFAULT_LAYOUT_SETTINGS;
  const density = settings?.graphDensity ?? 'comfortable';
  const densityScale = density === 'compact' ? 0.9 : density === 'spacious' ? 1.1 : 1;

  const treeSettings = layout.tree ?? DEFAULT_LAYOUT_SETTINGS.tree;
  const mindmapSettings = layout.mindmap ?? DEFAULT_LAYOUT_SETTINGS.mindmap;
  const radialSettings = layout.radial ?? DEFAULT_LAYOUT_SETTINGS.radial;

  const verticalGapScale = clamp(treeSettings.verticalGapScale, 0.4, 3);
  const horizontalGapScale = clamp(treeSettings.horizontalGapScale, 0.4, 3);
  const mindmapVerticalScale = clamp(mindmapSettings.verticalGapScale, 0.4, 3);
  const mindmapHorizontalScale = clamp(mindmapSettings.horizontalGapScale, 0.4, 3);

  const nodeWidth = Math.round(NODE_WIDTH * densityScale);
  const nodeHeight = Math.round(NODE_HEIGHT * densityScale);

  const tree: LayoutConfig = {
    nodeWidth,
    nodeHeight,
    verticalGap: Math.round(VERTICAL_GAP * verticalGapScale * densityScale),
    horizontalGap: Math.round(HORIZONTAL_GAP * horizontalGapScale * densityScale),
  };

  const mindmap: LayoutConfig = {
    nodeWidth,
    nodeHeight,
    verticalGap: Math.round(VERTICAL_GAP * mindmapVerticalScale * densityScale),
    horizontalGap: Math.round(HORIZONTAL_GAP * mindmapHorizontalScale * densityScale),
  };

  const angleWeightExp = clamp(radialSettings.angleWeightExp, 0.2, 1.2);
  const minSpanFactor = clamp(radialSettings.minSpanFactor, 0.4, 0.95);
  const minSpanAbs = clamp(radialSettings.minSpanAbs, 0.04, 0.5);
  const requiredScale = clamp(radialSettings.requiredScale, 0.35, 1.2);
  const depthGapBaseScale = clamp(radialSettings.depthGapBase, 0.6, 2.5);
  const depthGapGrowth = clamp(radialSettings.depthGapGrowth, 0, 0.8);

  const depthGapBase = Math.max(nodeHeight * depthGapBaseScale, VERTICAL_GAP * 0.85 * densityScale);
  const effectiveWidth = nodeWidth + HORIZONTAL_GAP * densityScale;

  const radial: RadialLayoutConfig = {
    angleWeightExp,
    minSpanFactor,
    minSpanAbs,
    requiredScale,
    depthGapBase,
    depthGapGrowth,
    effectiveWidth,
  };

  return {
    mode: layout.mode ?? DEFAULT_LAYOUT_SETTINGS.mode,
    tree,
    mindmap,
    radial,
  };
}
