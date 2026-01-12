import type { Settings } from '../../../../shared/types/settings.js';
import { DEFAULT_LAYOUT_SETTINGS } from '../../../../shared/layout/defaults.js';
import type { LayoutConfig, RadialLayoutConfig } from '../types.js';
import { HORIZONTAL_GAP, NODE_HEIGHT, NODE_WIDTH, VERTICAL_GAP } from './config.js';

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;

type LayoutOptions = {
  mode: 'tree' | 'radial';
  tree: LayoutConfig;
  radial: RadialLayoutConfig;
};

export function deriveLayoutOptions(settings: Settings | null | undefined): LayoutOptions {
  const layout = settings?.layout ?? DEFAULT_LAYOUT_SETTINGS;

  const treeSettings = layout.tree ?? DEFAULT_LAYOUT_SETTINGS.tree;
  const radialSettings = layout.radial ?? DEFAULT_LAYOUT_SETTINGS.radial;

  const verticalGapScale = clamp(treeSettings.verticalGapScale, 0.4, 3);
  const horizontalGapScale = clamp(treeSettings.horizontalGapScale, 0.4, 3);

  const tree: LayoutConfig = {
    nodeWidth: NODE_WIDTH,
    nodeHeight: NODE_HEIGHT,
    verticalGap: Math.round(VERTICAL_GAP * verticalGapScale),
    horizontalGap: Math.round(HORIZONTAL_GAP * horizontalGapScale),
  };

  const angleWeightExp = clamp(radialSettings.angleWeightExp, 0.2, 1.2);
  const minSpanFactor = clamp(radialSettings.minSpanFactor, 0.4, 0.95);
  const minSpanAbs = clamp(radialSettings.minSpanAbs, 0.04, 0.5);
  const requiredScale = clamp(radialSettings.requiredScale, 0.35, 1.2);
  const depthGapBaseScale = clamp(radialSettings.depthGapBase, 0.6, 2.5);
  const depthGapGrowth = clamp(radialSettings.depthGapGrowth, 0, 0.8);

  const depthGapBase = Math.max(NODE_HEIGHT * depthGapBaseScale, VERTICAL_GAP * 0.85);
  const effectiveWidth = NODE_WIDTH * 0.82 + HORIZONTAL_GAP * 0.35;

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
    radial,
  };
}
