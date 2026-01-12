import { ThemeId } from "../../sidepanel/ui/shared/themes.js";

export type LayoutMode = 'tree' | 'radial';

export type TreeLayoutSettings = {
    verticalGapScale: number;
    horizontalGapScale: number;
};

export type RadialLayoutSettings = {
    angleWeightExp: number;
    minSpanFactor: number;
    minSpanAbs: number;
    requiredScale: number;
    depthGapBase: number;
    depthGapGrowth: number;
};

export type LayoutSettings = {
    mode: LayoutMode;
    tree: TreeLayoutSettings;
    radial: RadialLayoutSettings;
};

export type Settings = {
    maxOpenTabs: number;
    capacity: number;
    theme: ThemeId;
    layout: LayoutSettings;
}
