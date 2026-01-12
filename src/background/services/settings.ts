import { THEME_IDS } from "../../sidepanel/ui/shared/themes.js";
import type { Settings } from "../../shared/types/settings.js";
import { DEFAULT_LAYOUT_SETTINGS } from "../../shared/layout/defaults.js";

export const defaultSettings: Settings = {
    maxOpenTabs: 100,
    capacity: Infinity,
    theme: THEME_IDS.SYSTEM,
    layout: {
        mode: DEFAULT_LAYOUT_SETTINGS.mode,
        tree: { ...DEFAULT_LAYOUT_SETTINGS.tree },
        mindmap: { ...DEFAULT_LAYOUT_SETTINGS.mindmap },
        radial: { ...DEFAULT_LAYOUT_SETTINGS.radial },
    },
}

const settingsKey = 'trail_settings' as const;
const settingsArea = chrome.storage.sync;

function mergeDefaults(raw: unknown): Settings {
    if (!raw || typeof raw !== 'object') {
        return {...defaultSettings};
    }
    const partial = raw as Partial<Settings>;
    const layout = partial.layout ?? DEFAULT_LAYOUT_SETTINGS;
    return {
        ...defaultSettings,
        ...partial,
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
        const result = await settingsArea.get({ [settingsKey]: defaultSettings }).catch(error => {
            console.error('SettingsManager.loadSettings: Error loading settings:', error);
            throw error;
        });
        this.settings = mergeDefaults(result[settingsKey]);
        return this.settings;
    }

    async saveSettings(next: Settings): Promise<void> {
        this.settings = { ...defaultSettings, ...next };
        await settingsArea.set({ [settingsKey]: this.settings }).catch(error => {
            console.error('SettingsManager.saveSettings: Error saving settings:', error);
            throw error;
        });
    }

    async patch(patch: Partial<Settings>): Promise<Settings> {
        const next = { ...this.settings, ...patch };
        await this.saveSettings(next);
        return this.settings;
    }
}

export const settingsManager = new SettingsManager();
settingsManager.init().catch(console.error);
