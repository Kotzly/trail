import { type Settings } from "@shared/types/settings.js";
import { settingsService } from "@shared/transport/proxy-clients.js";

export async function saveSettings(settings: Settings): Promise<void> {
  await settingsService.saveSettings({ settings });
}

export async function getSettings(): Promise<Settings> {
  return settingsService.getSettings();
}
