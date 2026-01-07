import { THEME_IDS } from "../../sidepanel/ui/shared/themes";
import type { Settings } from "../types/settings";

const defaultSettings: Settings = {
    maxOpenTabs: 100,
    capacity: 1000,
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

export class SettingsManager {
    private settings: Settings = { ...defaultSettings };
    
    async init(): Promise<void> {
        await this.loadSettings();
    }

    get(): Settings {
        return this.settings;
    }

    async loadSettings(): Promise<Settings> {
        const result = await settingsArea.get({ [settingsKey]: defaultSettings })
        this.settings = mergeDefaults(result[settingsKey]);
        return this.settings;
    }

    async saveSettings(next: Settings): Promise<void> {
        this.settings = { ...defaultSettings, ...next };
        await settingsArea.set({ [settingsKey]: this.settings });
    }

    async patch(patch: Partial<Settings>): Promise<Settings> {
        const next = { ...this.settings, ...patch };
        await this.saveSettings(next);
        return this.settings;
    }
}

