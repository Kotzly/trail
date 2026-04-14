import type { TreesSnapshot } from "@shared/rpc/contracts.js";
import type { TrailExportBundle } from "@shared/types/export.js";
import type { Settings } from "@shared/types/settings.js";
import {
  settingsService,
  treeService,
} from "@shared/transport/proxy-clients.js";

export async function getSettings(): Promise<Settings> {
  return settingsService.getSettings();
}

export async function saveSettings(settings: Settings): Promise<void> {
  await settingsService.saveSettings({ settings });
}

export async function getTrees(): Promise<TreesSnapshot> {
  return treeService.getTrees();
}

export async function newTree(label: string): Promise<void> {
  await treeService.createNewTree({ label });
}

export async function openTree(treeId: string): Promise<void> {
  await treeService.openTree({ treeId });
}

export async function renameTree(treeId: string, label: string): Promise<void> {
  await treeService.renameTree({ treeId, label });
}

export async function archiveActiveTree(): Promise<void> {
  await treeService.archiveActiveTree();
}

export async function deleteArchivedTree(treeId: string): Promise<void> {
  await treeService.deleteArchivedTree({ treeId });
}

export async function exportTree(treeId?: string): Promise<TrailExportBundle> {
  const payload: { treeId?: string } = {};
  if (treeId !== undefined) payload.treeId = treeId;
  return treeService.exportTree(payload);
}

export async function importTrail(bundle: TrailExportBundle): Promise<void> {
  await treeService.importTrail({ bundle });
}
