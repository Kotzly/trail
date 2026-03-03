import { THEME_IDS } from "@features/themes/model.js";
import type { CustomTheme, Settings, ThemeHarmony, ThemeDotType } from "../../shared/types/settings.js";
import { DEFAULT_LAYOUT_SETTINGS } from "../../shared/layout/defaults.js";
import { settingsItem } from "../../shared/config/storage-items.js";

const DEFAULT_CUSTOM_THEME: CustomTheme = {
    enabled: false,
    dots: [],
    harmony: 'floating',
    lightness: 50,
    opacity: 0.6,
    texture: 0,
    customColors: [],
    accentColor: null,
};

const THEME_HARMONIES: ThemeHarmony[] = [
    'floating',
    'complementary',
    'singleAnalogous',
    'splitComplementary',
    'analogous',
    'triadic',
];

const THEME_DOT_TYPES: ThemeDotType[] = ['explicit-lightness', 'explicit-black-white'];

const clamp01 = (value: number, fallback: number) =>
    Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : fallback;

const clamp = (value: number, min: number, max: number, fallback: number) =>
    Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;

function normalizeCustomTheme(raw: unknown): CustomTheme {
    if (!raw || typeof raw !== 'object') {
        return { ...DEFAULT_CUSTOM_THEME };
    }
    const partial = raw as Partial<CustomTheme>;
    const rawDots = Array.isArray(partial.dots) ? partial.dots : DEFAULT_CUSTOM_THEME.dots;
    const dots = rawDots
        .map((dot) => {
            const dotType = THEME_DOT_TYPES.includes(dot?.type as ThemeDotType)
                ? (dot?.type as ThemeDotType)
                : undefined;
            return {
                x: clamp(dot?.x ?? 0.5, 0, 1, 0.5),
                y: clamp(dot?.y ?? 0.5, 0, 1, 0.5),
                ...(dotType ? { type: dotType } : {}),
            };
        })
        .slice(0, 3);
    return {
        ...DEFAULT_CUSTOM_THEME,
        ...partial,
        enabled: Boolean(partial.enabled),
        dots: dots.length ? dots : DEFAULT_CUSTOM_THEME.dots,
        harmony: THEME_HARMONIES.includes(partial.harmony as ThemeHarmony)
            ? (partial.harmony as ThemeHarmony)
            : DEFAULT_CUSTOM_THEME.harmony,
        lightness: clamp(partial.lightness ?? DEFAULT_CUSTOM_THEME.lightness, 0, 100, 50),
        opacity: clamp01(partial.opacity ?? DEFAULT_CUSTOM_THEME.opacity, DEFAULT_CUSTOM_THEME.opacity),
        texture: clamp01(partial.texture ?? DEFAULT_CUSTOM_THEME.texture, DEFAULT_CUSTOM_THEME.texture),
        customColors: Array.isArray(partial.customColors)
            ? partial.customColors
                .filter((color) => typeof color === 'string' && color.trim().length > 0)
                .slice(0, 4)
            : DEFAULT_CUSTOM_THEME.customColors,
        accentColor:
            typeof partial.accentColor === 'string' && /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(partial.accentColor)
                ? partial.accentColor
                : DEFAULT_CUSTOM_THEME.accentColor,
    };
}

export const defaultSettings: Settings = {
    theme: THEME_IDS.SYSTEM,
    customTheme: { ...DEFAULT_CUSTOM_THEME },
    layout: {
        mode: DEFAULT_LAYOUT_SETTINGS.mode,
        tree: { ...DEFAULT_LAYOUT_SETTINGS.tree },
        mindmap: { ...DEFAULT_LAYOUT_SETTINGS.mindmap },
        radial: { ...DEFAULT_LAYOUT_SETTINGS.radial },
    },
    titleTruncation: 'end',
    graphDensity: 'comfortable',
    showFavicons: true,
    showUrls: true,
    showTagDots: true,
    showTabCounts: true,
    showAudioIndicators: true,
    showConnections: true,
    dimClosedNodes: true,
    confirmNewTree: true,
    shortcutsEnabled: true,
    adaptivePerformance: true,
    keepTabsOnSwitch: true,
};

function mergeDefaults(raw: unknown): Settings {
    if (!raw || typeof raw !== 'object') {
        return {...defaultSettings};
    }
    const partial = raw as Partial<Settings> & {
        adaptiveMode?: unknown;
        adaptiveModeLayouts?: unknown;
    };
    const { adaptiveMode: _adaptiveMode, adaptiveModeLayouts: _adaptiveModeLayouts, ...rest } = partial;
    const sanitized = rest as Partial<Settings>;
    const layout = sanitized.layout ?? DEFAULT_LAYOUT_SETTINGS;
    return {
        ...defaultSettings,
        ...sanitized,
        customTheme: normalizeCustomTheme(sanitized.customTheme),
        layout: {
            mode: layout.mode ?? DEFAULT_LAYOUT_SETTINGS.mode,
            tree: {
                ...DEFAULT_LAYOUT_SETTINGS.tree,
                ...(layout.tree ?? {}),
            },
            mindmap: {
                ...DEFAULT_LAYOUT_SETTINGS.mindmap,
                ...(layout.mindmap ?? {}),
            },
            radial: {
                ...DEFAULT_LAYOUT_SETTINGS.radial,
                ...(layout.radial ?? {}),
            },
        },
        titleTruncation: sanitized.titleTruncation ?? defaultSettings.titleTruncation,
        graphDensity: sanitized.graphDensity ?? defaultSettings.graphDensity,
        showFavicons: sanitized.showFavicons ?? defaultSettings.showFavicons,
        showUrls: sanitized.showUrls ?? defaultSettings.showUrls,
        showTagDots: sanitized.showTagDots ?? defaultSettings.showTagDots,
        showTabCounts: sanitized.showTabCounts ?? defaultSettings.showTabCounts,
        showAudioIndicators: sanitized.showAudioIndicators ?? defaultSettings.showAudioIndicators,
        showConnections: sanitized.showConnections ?? defaultSettings.showConnections,
        dimClosedNodes: sanitized.dimClosedNodes ?? defaultSettings.dimClosedNodes,
        confirmNewTree: sanitized.confirmNewTree ?? defaultSettings.confirmNewTree,
        shortcutsEnabled: sanitized.shortcutsEnabled ?? defaultSettings.shortcutsEnabled,
        adaptivePerformance: sanitized.adaptivePerformance ?? defaultSettings.adaptivePerformance,
        keepTabsOnSwitch: sanitized.keepTabsOnSwitch ?? defaultSettings.keepTabsOnSwitch,
    };
}

class SettingsManager {
    private settings: Settings = { ...defaultSettings };

    async init(): Promise<void> {
        await this.loadSettings();
    }

    get(): Settings {
        return this.settings;
    }

    async loadSettings(): Promise<Settings> {
        try {
            const stored = await settingsItem.getValue();
            this.settings = mergeDefaults(stored);
        } catch (error) {
            console.error('SettingsManager.loadSettings: Error loading settings:', error);
            throw error;
        }
        return this.settings;
    }

    async saveSettings(next: Settings): Promise<void> {
        this.settings = { ...defaultSettings, ...next };
        try {
            await settingsItem.setValue(this.settings);
        } catch (error) {
            console.error('SettingsManager.saveSettings: Error saving settings:', error);
            throw error;
        }
    }

    async patch(patch: Partial<Settings>): Promise<Settings> {
        const next = { ...this.settings, ...patch };
        await this.saveSettings(next);
        return this.settings;
    }
}

export const settingsManager = new SettingsManager();
settingsManager.init().catch(console.error);
