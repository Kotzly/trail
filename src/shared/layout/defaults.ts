import type { LayoutSettings } from '../types/settings.js';

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
    mode: 'radial',
    tree: {
        verticalGapScale: 1,
        horizontalGapScale: 1,
    },
    mindmap: {
        verticalGapScale: 1,
        horizontalGapScale: 1,
    },
    radial: {
        angleWeightExp: 0.42,
        minSpanFactor: 0.75,
        minSpanAbs: 0.12,
        requiredScale: 0.7,
        depthGapBase: 1.25,
        depthGapGrowth: 0.22,
    },
};
