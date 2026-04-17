import { cleanupService } from "@shared/transport/proxy-clients.js";
import type { CleanupTombstoneEntry } from "@shared/rpc/contracts.js";
import type { NodeId } from "@shared/types/ids.js";

export async function listTombstones(): Promise<CleanupTombstoneEntry[]> {
  return cleanupService.listTombstones();
}

export async function restoreTombstone(nodeId: string): Promise<{ restoredNodeId: NodeId } | null> {
  return cleanupService.restoreTombstone({ nodeId });
}

export async function dismissTombstone(nodeId: string): Promise<void> {
  await cleanupService.dismissTombstone({ nodeId });
}

export async function clearTombstones(): Promise<void> {
  await cleanupService.clearTombstones();
}

export async function promoteBurstItem(nodeId: NodeId): Promise<boolean> {
  return cleanupService.promoteBurstItem({ nodeId });
}

export async function sealBurst(containerId: NodeId): Promise<boolean> {
  return cleanupService.sealBurst({ containerId });
}
