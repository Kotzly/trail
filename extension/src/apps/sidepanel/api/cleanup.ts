import { cleanupService } from "@shared/transport/proxy-clients.js";
import type { CleanupTombstoneEntry } from "@shared/rpc/contracts.js";
import type { NodeId } from "@shared/types/ids.js";

export async function listTombstones(): Promise<CleanupTombstoneEntry[]> {
  return cleanupService.listTombstones();
}

export async function restoreTombstone(nodeId: string): Promise<{ restoredNodeId: NodeId } | null> {
  return cleanupService.restoreTombstone({ nodeId });
}
