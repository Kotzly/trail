import { ThemeId } from "../../sidepanel/ui/shared/themes.js";

export type LayoutMode = 'tree' | 'radial' | 'mindmap';

export type TreeLayoutSettings = {
    verticalGapScale: number;
    horizontalGapScale: number;
    hideRoot: boolean;
};

export type MindmapLayoutSettings = {
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
    mindmap: MindmapLayoutSettings;
    radial: RadialLayoutSettings;
};

export type TitleTruncation = 'start' | 'middle' | 'end';

export type GraphDensity = 'compact' | 'comfortable' | 'spacious';

export type AdaptiveModeLayouts = Record<LayoutMode, boolean>;

export type Settings = {
    maxOpenTabs: number;
    capacity: number;
    theme: ThemeId;
    layout: LayoutSettings;
    titleTruncation: TitleTruncation;
    graphDensity: GraphDensity;
    showFavicons: boolean;
    showUrls: boolean;
    showTagDots: boolean;
    showTabCounts: boolean;
    showAudioIndicators: boolean;
    showConnections: boolean;
    dimClosedNodes: boolean;
    confirmNewTree: boolean;
    shortcutsEnabled: boolean;
    adaptiveMode: boolean;
    adaptiveModeLayouts: AdaptiveModeLayouts;
}
