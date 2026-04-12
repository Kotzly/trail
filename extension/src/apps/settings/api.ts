import { type RequestType, type MessageByType, type ResponseMessage, rpc } from "@shared/rpc/contracts.js";
import { sendRpcMessage } from "@shared/rpc/client.js";
import type { Settings } from "@shared/types/settings.js";
import type { TreesSnapshot } from "@shared/rpc/contracts.js";
import type { TrailExportBundle } from "@shared/types/export.js";

function send<T extends RequestType>(message: MessageByType<T>): Promise<ResponseMessage<T>> {
  return sendRpcMessage(message);
}

export async function getSettings(): Promise<Settings> {
  const res = await send(rpc.getSettings());
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const res = await send(rpc.saveSettings({ settings }));
  if (!res.success) throw new Error(res.error);
}

export async function getTrees(): Promise<TreesSnapshot> {
  const res = await send(rpc.getTrees());
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function newTree(label: string): Promise<void> {
  const res = await send(rpc.newTree({ label }));
  if (!res.success) throw new Error(res.error);
}

export async function openTree(treeId: string): Promise<void> {
  const res = await send(rpc.openTree({ treeId }));
  if (!res.success) throw new Error(res.error);
}

export async function renameTree(treeId: string, label: string): Promise<void> {
  const res = await send(rpc.renameTree({ treeId, label }));
  if (!res.success) throw new Error(res.error);
}

export async function archiveActiveTree(): Promise<void> {
  const res = await send(rpc.archiveActiveTree());
  if (!res.success) throw new Error(res.error);
}

export async function deleteArchivedTree(treeId: string): Promise<void> {
  const res = await send(rpc.deleteArchivedTree({ treeId }));
  if (!res.success) throw new Error(res.error);
}

export async function exportTree(treeId?: string): Promise<TrailExportBundle> {
  const payload: { treeId?: string } = {};
  if (treeId !== undefined) payload.treeId = treeId;
  const res = await send(rpc.exportTree(payload));
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function importTrail(bundle: TrailExportBundle): Promise<void> {
  const res = await send(rpc.importTrail({ bundle }));
  if (!res.success) throw new Error(res.error);
}
