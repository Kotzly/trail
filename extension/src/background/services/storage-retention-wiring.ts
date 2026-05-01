import { createLogger } from "@shared/lib/logger.js";
import { getAuthState } from "@shared/auth/auth-orchestrator.js";
import { ensureStoredTreePushed } from "../sync/sync-engine.js";
import { notifyTreesUpdate } from "../messaging/notifications.js";
import { treeStorage } from "./tree-storage.js";
import { setRetentionDeps, setRetentionLogger, type RetentionDeps } from "./storage-retention.js";

/**
 * Wire the production dependency bundle into the storage-retention
 * module. Kept in a separate file so the core module is importable
 * by tests without pulling in WXT/chrome runtime.
 *
 * Call once at service-worker startup.
 */
export function wireStorageRetention(): void {
  const log = createLogger("storage-retention");
  setRetentionLogger({
    info: (msg, fields) => log.info(msg, fields),
    warn: (msg, fields) => log.warn(msg, fields),
    error: (msg, fields) => log.error(msg, fields),
  });

  const deps: RetentionDeps = {
    getBytesInUse: async () => {
      if (typeof chrome === "undefined" || !chrome.storage?.local) return 0;
      return chrome.storage.local.getBytesInUse(null);
    },
    isSignedIn: () => getAuthState().status === "signed-in",
    getActiveId: async () => (await treeStorage.getActiveMeta()).id,
    getIndex: () => treeStorage.getTreeIndex(),
    pushTree: (treeId) => ensureStoredTreePushed(treeId) as Promise<string>,
    deleteBlob: (treeId) => treeStorage.deleteStoredBlob(treeId),
    stubEntry: (treeId) => treeStorage.stubTreeEntry(treeId),
    notifyUpdate: async () => {
      const [active, others] = await Promise.all([
        treeStorage.getActiveMeta(),
        treeStorage.getStoredSummaries(),
      ]);
      await notifyTreesUpdate({ active, others });
    },
    now: () => Date.now(),
  };

  setRetentionDeps(deps);
}
