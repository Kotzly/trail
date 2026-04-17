/**
 * RPC handlers for the cleanup/tombstone subsystem.
 *
 * Exposes:
 *   LIST_CLEANUP_TOMBSTONES   — drawer feed
 *   RESTORE_CLEANUP_TOMBSTONE — user-initiated revive from drawer
 *   DISMISS_CLEANUP_TOMBSTONE — drop a single tombstone
 *   CLEAR_CLEANUP_TOMBSTONES  — drop all
 */

import type { Url } from "@shared/types/ids.js";
import {
  RPC_METHOD,
  defineRpcHandlers,
  type CleanupTombstoneEntry,
} from "@shared/rpc/contracts.js";
import {
  listTombstones,
  clearAllTombstones,
  clearTombstone,
} from "../../services/cleanup-tombstones.js";
import { reviveFromTombstone } from "../../services/cleanup-policy.js";
import { treeStorage } from "../../services/tree-storage.js";
import { notifyTreeUpdate } from "../notifications.js";

export const cleanupHandlers = defineRpcHandlers({
  async [RPC_METHOD.LIST_CLEANUP_TOMBSTONES](): Promise<CleanupTombstoneEntry[]> {
    const tombstones = await listTombstones();
    // Same shape; the shared type mirrors CleanupTombstone.
    return tombstones as CleanupTombstoneEntry[];
  },

  async [RPC_METHOD.RESTORE_CLEANUP_TOMBSTONE](message) {
    const tombstones = await listTombstones();
    const tombstone = tombstones.find((t) => t.nodeId === message.nodeId);
    if (!tombstone) return null;
    const result = await reviveFromTombstone(tombstone.url as Url);
    if (!result) return null;
    const tree = await treeStorage.getOrCreateTree();
    await notifyTreeUpdate(tree, "undo");
    return { restoredNodeId: result.nodeId };
  },

  async [RPC_METHOD.CLEAR_CLEANUP_TOMBSTONES](): Promise<void> {
    await clearAllTombstones();
  },

  async [RPC_METHOD.DISMISS_CLEANUP_TOMBSTONE](message): Promise<void> {
    await clearTombstone(message.nodeId);
  },
});
