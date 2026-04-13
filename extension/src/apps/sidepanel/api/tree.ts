import type { NavigationNode } from "@shared/types/node.js";
import type { NodeId, TabId } from "@shared/types/ids.js";
import {
  rpc,
  type BeginTempSelectionInput,
  type NodeLayoutInput,
  type TempSelectionSessionId,
  type TreeUpdatedInput,
  type TreesSnapshot,
} from "../../../shared/rpc/contracts.js";
import type { TrailExportBundle } from "@shared/types/export.js";
import { sendMessage } from "./background.js";

export async function navigateTo(node: NavigationNode): Promise<void> {
  const res = await sendMessage(rpc.navigateTo({ url: node.data.url, nodeId: node.id }));
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function previewNode(nodeId: NodeId): Promise<void> {
  const res = await sendMessage(rpc.previewNode({ nodeId }));
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function setCurrentNode(nodeId: NodeId): Promise<void> {
  const res = await sendMessage(rpc.setCurrent({ nodeId }));
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function beginTempSelection(
  payload: BeginTempSelectionInput,
): Promise<{ sessionId: TempSelectionSessionId }> {
  const res = await sendMessage(rpc.beginTempSelection(payload));
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function previewTempSelection(
  sessionId: TempSelectionSessionId,
  nodeId: NodeId,
  tabId?: TabId,
): Promise<{ previewedTabId: TabId | null }> {
  const res = await sendMessage(
    rpc.previewTempSelection({ sessionId, nodeId, tabId } as {
      sessionId: TempSelectionSessionId;
      nodeId: NodeId;
      tabId?: TabId;
    }),
  );
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function acceptTempSelection(
  sessionId: TempSelectionSessionId,
  nodeId?: NodeId,
): Promise<void> {
  const res = await sendMessage(
    rpc.acceptTempSelection({ sessionId, nodeId } as {
      sessionId: TempSelectionSessionId;
      nodeId?: NodeId;
    }),
  );
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function cancelTempSelection(
  sessionId: TempSelectionSessionId,
  options?: { keepSession?: boolean },
): Promise<void> {
  const res = await sendMessage(rpc.cancelTempSelection({ sessionId, ...options }));
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function endTempSelection(sessionId: TempSelectionSessionId): Promise<void> {
  const res = await sendMessage(rpc.endTempSelection({ sessionId }));
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function getTreeState(): Promise<TreeUpdatedInput> {
  const res = await sendMessage(rpc.getTree());
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function getTrees(): Promise<TreesSnapshot> {
  const res = await sendMessage(rpc.getTrees());
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function clearTree(): Promise<void> {
  const res = await sendMessage(rpc.clearTree());
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function createNewTree(label: string): Promise<void> {
  const res = await sendMessage(rpc.newTree({ label }));
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function openTree(treeId: string): Promise<void> {
  const res = await sendMessage(rpc.openTree({ treeId }));
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function ensureTreeLoaded(treeId: string): Promise<boolean> {
  const res = await sendMessage(rpc.ensureTreeLoaded({ treeId }));
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function renameTree(treeId: string, label: string): Promise<void> {
  const res = await sendMessage(rpc.renameTree({ treeId, label }));
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function deleteArchivedTree(treeId: string): Promise<void> {
  const res = await sendMessage(rpc.deleteArchivedTree({ treeId }));
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function exportTree(treeId?: string): Promise<TrailExportBundle> {
  const payload: { treeId?: string } = {};
  if (treeId !== undefined) payload.treeId = treeId;
  const res = await sendMessage(rpc.exportTree(payload));
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function setNodeLayout(
  nodeId: NodeId,
  layout: {
    offsetX?: number;
    offsetY?: number;
    radial?: { angleDelta: number; radiusDelta: number };
  },
): Promise<void> {
  const res = await sendMessage(rpc.setNodeLayout({ nodeId, ...layout }));
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function setNodeLayoutBatch(layouts: NodeLayoutInput[]): Promise<void> {
  const res = await sendMessage(rpc.setNodeLayoutBatch({ layouts }));
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function resetNodeLayouts(): Promise<void> {
  const res = await sendMessage(rpc.resetNodeLayouts());
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function importTrail(bundle: TrailExportBundle): Promise<{ treeId: string }> {
  const res = await sendMessage(rpc.importTrail({ bundle }));
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export async function reparentNode(nodeId: NodeId, newParentId: NodeId): Promise<void> {
  const res = await sendMessage(rpc.reparentNode({ nodeId, newParentId }));
  if (!res.success) throw new Error(res.error);
  return res.data;
}
