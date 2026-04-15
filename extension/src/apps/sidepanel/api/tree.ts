import type { NavigationNode } from "@shared/types/node.js";
import type { NodeId, TabId, Url } from "@shared/types/ids.js";
import {
  type BeginTempSelectionInput,
  type NodeLayoutInput,
  type TempSelectionSessionId,
  type TreeUpdatedInput,
  type TreesSnapshot,
} from "../../../shared/rpc/contracts.js";
import { treeService } from "@shared/transport/proxy-clients.js";
import type { TrailExportBundle } from "@shared/types/export.js";

export async function navigateTo(node: NavigationNode): Promise<void> {
  await treeService.navigateTo({ nodeId: node.id, ...(node.data.url ? { url: node.data.url } : {}) });
}

export async function navigateToNodeId(nodeId: NodeId, url?: Url): Promise<void> {
  await treeService.navigateTo({ nodeId, ...(url ? { url } : {}) });
}

export async function previewNode(nodeId: NodeId): Promise<void> {
  await treeService.previewNode({ nodeId });
}

export async function setCurrentNode(nodeId: NodeId): Promise<void> {
  await treeService.setCurrentNode({ nodeId });
}

export async function beginTempSelection(
  payload: BeginTempSelectionInput,
): Promise<{ sessionId: TempSelectionSessionId }> {
  return treeService.beginTempSelection(payload);
}

export async function previewTempSelection(
  sessionId: TempSelectionSessionId,
  nodeId: NodeId,
  tabId?: TabId,
): Promise<{ previewedTabId: TabId | null }> {
  return treeService.previewTempSelection({
    sessionId,
    nodeId,
    ...(tabId !== undefined ? { tabId } : {}),
  });
}

export async function acceptTempSelection(
  sessionId: TempSelectionSessionId,
  nodeId?: NodeId,
): Promise<void> {
  await treeService.acceptTempSelection({
    sessionId,
    ...(nodeId !== undefined ? { nodeId } : {}),
  });
}

export async function cancelTempSelection(
  sessionId: TempSelectionSessionId,
  options?: { keepSession?: boolean },
): Promise<void> {
  await treeService.cancelTempSelection({ sessionId, ...options });
}

export async function endTempSelection(sessionId: TempSelectionSessionId): Promise<void> {
  await treeService.endTempSelection({ sessionId });
}

export async function getTreeState(): Promise<TreeUpdatedInput> {
  return treeService.getTreeState();
}

export async function getTrees(): Promise<TreesSnapshot> {
  return treeService.getTrees();
}

export async function clearTree(): Promise<void> {
  await treeService.clearTree();
}

export async function createNewTree(label: string): Promise<void> {
  await treeService.createNewTree({ label });
}

export async function openTree(treeId: string): Promise<void> {
  await treeService.openTree({ treeId });
}

export async function ensureTreeLoaded(treeId: string): Promise<boolean> {
  return treeService.ensureTreeLoaded({ treeId });
}

export async function renameTree(treeId: string, label: string): Promise<void> {
  await treeService.renameTree({ treeId, label });
}

export async function deleteArchivedTree(treeId: string): Promise<void> {
  await treeService.deleteArchivedTree({ treeId });
}

export async function exportTree(treeId?: string): Promise<TrailExportBundle> {
  const payload: { treeId?: string } = {};
  if (treeId !== undefined) payload.treeId = treeId;
  return treeService.exportTree(payload);
}

export async function setNodeLayout(
  nodeId: NodeId,
  layout: {
    offsetX?: number;
    offsetY?: number;
  },
): Promise<void> {
  await treeService.setNodeLayout({ nodeId, ...layout });
}

export async function setNodeLayoutBatch(layouts: NodeLayoutInput[]): Promise<void> {
  await treeService.setNodeLayoutBatch({ layouts });
}

export async function resetNodeLayouts(): Promise<void> {
  await treeService.resetNodeLayouts();
}

export async function importTrail(bundle: TrailExportBundle): Promise<{ treeId: string }> {
  return treeService.importTrail({ bundle });
}

export async function reparentNode(nodeId: NodeId, newParentId: NodeId): Promise<void> {
  await treeService.reparentNode({ nodeId, newParentId });
}
