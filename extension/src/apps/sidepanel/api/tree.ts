import type { NodeId, TabId, Url } from "@shared/types/ids.js";
import {
  type BeginTempSelectionInput,
  type DeleteTreeResponse,
  type NodeLayoutInput,
  type RestorableTreeSnapshot,
  type TempSelectionSessionId,
  type TreeUpdatedInput,
  type TreesSnapshot,
} from "../../../shared/rpc/contracts.js";
import { treeService } from "@shared/transport/proxy-clients.js";
import type { TrailExportBundle } from "@shared/types/export.js";

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

export async function deleteTree(treeId: string): Promise<DeleteTreeResponse> {
  return treeService.deleteTree({ treeId });
}

export async function restoreTree(snapshot: RestorableTreeSnapshot): Promise<void> {
  await treeService.restoreTree({ snapshot });
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

export async function renameNode(nodeId: NodeId, title: string): Promise<void> {
  await treeService.renameNode({ nodeId, title });
}

// Sync-conflict RPCs ---------------------------------------------------

// Guard every call so a transient RPC miss (e.g. background SW warming
// up, stale bundle) surfaces as a typed error instead of a runtime
// TypeError inside the caller.

export async function fetchConflictPreview(treeId: string) {
  try {
    const res = await treeService.fetchConflictPreview({ treeId });
    if (!res || typeof res !== "object" || !("ok" in res)) {
      console.error("[conflict] fetchConflictPreview returned invalid response", res);
      return { ok: false as const, error: { reason: "network" as const } };
    }
    return res;
  } catch (err) {
    console.error("[conflict] fetchConflictPreview threw", err);
    return { ok: false as const, error: { reason: "network" as const } };
  }
}

export async function getStoredTreeForConflict(treeId: string) {
  try {
    const res = await treeService.getStoredTreeForConflict({ treeId });
    if (!res || typeof res !== "object") {
      console.error("[conflict] getStoredTreeForConflict returned invalid response", res);
      return { compact: null };
    }
    return res;
  } catch (err) {
    console.error("[conflict] getStoredTreeForConflict threw", err);
    return { compact: null };
  }
}

export async function applyConflictMerge(
  input: Parameters<typeof treeService.applyConflictMerge>[0],
) {
  try {
    const res = await treeService.applyConflictMerge(input);
    if (!res || typeof res !== "object" || !("ok" in res)) {
      console.error("[conflict] applyConflictMerge returned invalid response", res);
      return { ok: false as const, error: { reason: "network" as const } };
    }
    return res;
  } catch (err) {
    console.error("[conflict] applyConflictMerge threw", err);
    return { ok: false as const, error: { reason: "network" as const } };
  }
}

export async function forkTreeFromConflict(treeId: string) {
  try {
    const res = await treeService.forkTreeFromConflict({ treeId });
    if (!res || typeof res !== "object" || !("ok" in res)) {
      console.error("[conflict] forkTreeFromConflict returned invalid response", res);
      return { ok: false as const, reason: "network" };
    }
    return res;
  } catch (err) {
    console.error("[conflict] forkTreeFromConflict threw", err);
    return { ok: false as const, reason: "network" };
  }
}

export async function getPendingConflicts() {
  try {
    const res = await treeService.getPendingConflicts();
    if (!res || typeof res !== "object" || !Array.isArray(res.conflicts)) {
      return { conflicts: [] };
    }
    return res;
  } catch (err) {
    console.error("[conflict] getPendingConflicts threw", err);
    return { conflicts: [] };
  }
}
