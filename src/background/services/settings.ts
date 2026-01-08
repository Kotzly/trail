import { THEME_IDS } from "../../sidepanel/ui/shared/themes.js";
import type { Settings } from "../../shared/types/settings.js";

export const defaultSettings: Settings = {
    maxOpenTabs: 100,
    capacity: Infinity,
    theme: THEME_IDS.SYSTEM,
}

const settingsKey = 'trail_settings' as const;
const settingsArea = chrome.storage.sync;

function mergeDefaults(raw: unknown): Settings {
    if (!raw || typeof raw !== 'object') {
        return {...defaultSettings};
    }
    return {...defaultSettings, ...(raw as Partial<Settings>)};
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

export const settingsManager = await (async (): Promise<SettingsManager> => {
    const manager = new SettingsManager();
    await manager.init();
    return manager;
})();