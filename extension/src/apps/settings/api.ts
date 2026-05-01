import type { TreesSnapshot } from "@shared/rpc/contracts.js";
import type { TrailExportBundle } from "@shared/types/export.js";
import type { Settings } from "@shared/types/settings.js";
import { settingsService, treeService } from "@shared/transport/proxy-clients.js";

export async function getSettings(): Promise<Settings> {
  return settingsService.getSettings();
}

export async function saveSettings(settings: Settings): Promise<void> {
  await settingsService.saveSettings({ settings });
}

export async function getTrees(): Promise<TreesSnapshot> {
  return treeService.getTrees();
}

// All tree-switch operations originating from the Settings UI pass
// `origin: "settings"` so the background can open the new tab in the
// background — the user stays on the Settings tab they initiated the
// switch from instead of getting yanked to the freshly-opened tree
// tab. Sidepanel callers omit `origin` and get the default
// focus-the-new-tab behaviour.
const SETTINGS_ORIGIN = { origin: "settings" as const };

export async function newTree(label: string): Promise<void> {
  await treeService.createNewTree({ label, ...SETTINGS_ORIGIN });
}

export async function openTree(treeId: string): Promise<void> {
  await treeService.openTree({ treeId, ...SETTINGS_ORIGIN });
}

export async function renameTree(treeId: string, label: string): Promise<void> {
  await treeService.renameTree({ treeId, label });
}

export async function deleteTree(treeId: string): Promise<void> {
  await treeService.deleteTree({ treeId });
}

export async function exportTree(treeId?: string): Promise<TrailExportBundle> {
  const payload: { treeId?: string } = {};
  if (treeId !== undefined) payload.treeId = treeId;
  return treeService.exportTree(payload);
}

export async function importTrail(bundle: TrailExportBundle): Promise<void> {
  await treeService.importTrail({ bundle });
}

export async function resetTreeData(): Promise<void> {
  await treeService.resetTreeData();
}

export async function downloadTreeLocally(treeId: string): Promise<void> {
  await treeService.downloadTreeLocally({ treeId });
}

export async function unloadTreeToCloud(treeId: string): Promise<void> {
  await treeService.unloadTreeToCloud({ treeId });
}
