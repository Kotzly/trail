/**
 * RPC handlers for the sync-conflict dialog:
 *   - FETCH_CONFLICT_PREVIEW  — lazy server-side fetch (no side effects)
 *   - GET_STORED_TREE_FOR_CONFLICT — decode a local stored tree for diff
 *   - APPLY_CONFLICT_MERGE    — optimistic-concurrency merge write-back
 *
 * Business logic lives in `sync-engine.ts` and the pure functions in
 * `shared/lib/tree-diff.ts`; these handlers are thin adapters.
 */

import { RPC_METHOD, defineRpcHandlers } from "@shared/rpc/contracts.js";
import {
  applyConflictMergeInternal,
  fetchRemoteTreeForConflict,
  forkTreeFromConflict,
  getPendingConflictsSnapshot,
} from "@background/sync/sync-engine.js";
import { treeStorage } from "@background/services/tree-storage.js";
import { isTreeStub } from "@shared/types/tree.js";
import { toCompact } from "@shared/lib/compact-mapper.js";
import { createLogger } from "@shared/lib/logger.js";

const log = createLogger("sync-conflict");

export const syncConflictHandlers = defineRpcHandlers({
  async [RPC_METHOD.FETCH_CONFLICT_PREVIEW](message) {
    log.info("fetchConflictPreview: received", { treeId: message.treeId });
    try {
      const res = await fetchRemoteTreeForConflict(message.treeId);
      log.info("fetchConflictPreview: returning", { ok: res.ok });
      return res;
    } catch (err) {
      log.error("fetchConflictPreview: threw", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { ok: false as const, error: { reason: "network" as const } };
    }
  },

  async [RPC_METHOD.GET_STORED_TREE_FOR_CONFLICT](message) {
    try {
      const index = await treeStorage.getTreeIndex();
      const entry = index.find((e) => e.id === message.treeId);
      if (!entry || isTreeStub(entry)) return { compact: null };
      const json = await treeStorage.getStoredTree(message.treeId);
      if (!json) return { compact: null };
      return { compact: toCompact(json) };
    } catch (err) {
      log.error("getStoredTreeForConflict: threw", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { compact: null };
    }
  },

  async [RPC_METHOD.APPLY_CONFLICT_MERGE](message) {
    log.info("applyConflictMerge: received", {
      treeId: message.treeId,
      mode: message.mode,
    });
    try {
      const { type: _type, ...input } = message;
      const res = await applyConflictMergeInternal(input);
      log.info("applyConflictMerge: returning", { ok: res.ok });
      return res;
    } catch (err) {
      log.error("applyConflictMerge: threw", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { ok: false as const, error: { reason: "network" as const } };
    }
  },

  async [RPC_METHOD.FORK_TREE_FROM_CONFLICT](message) {
    log.info("forkTreeFromConflict: received", { treeId: message.treeId });
    try {
      const res = await forkTreeFromConflict(message.treeId);
      log.info("forkTreeFromConflict: returning", { ok: res.ok });
      return res;
    } catch (err) {
      log.error("forkTreeFromConflict: threw", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { ok: false as const, reason: "network" };
    }
  },

  async [RPC_METHOD.GET_PENDING_CONFLICTS]() {
    return { conflicts: getPendingConflictsSnapshot() };
  },
});
