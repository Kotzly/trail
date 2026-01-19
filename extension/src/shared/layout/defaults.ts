import type { LayoutSettings } from '../types/settings.js';

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
    mode: 'radial',
    tree: {
        verticalGapScale: 1,
        horizontalGapScale: 1,
        hideRoot: false,
    },
    mindmap: {
        verticalGapScale: 1,
        horizontalGapScale: 1,
    },
    radial: {
        angleWeightExp: 0.42,
        minSpanFactor: 0.75,
        minSpanAbs: 0.11,
        requiredScale: 0.85,
        depthGapBase: 2.2,
        depthGapGrowth: 0.08,
    },
};
