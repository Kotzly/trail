import { useEffect, useState } from "react";
import { storage } from "wxt/utils/storage";
import {
  syncStateItem,
  pendingSyncOpsItem,
  type SyncStateMeta,
  type PendingSyncOp,
} from "@shared/config/storage-items.js";
import { EXTENSION_MESSAGE, onExtensionMessage } from "@shared/transport/extension-messaging.js";
import type { SyncSurfaceStatus } from "@background/sync/sync-engine.js";

export type SyncSummary = {
  status: SyncSurfaceStatus;
  syncedTreeCount: number;
  pendingOpCount: number;
  lastSyncedAt: string | null;
};

export function useSyncSummary(): SyncSummary {
  const [status, setStatus] = useState<SyncSurfaceStatus>("idle");
  const [stateMap, setStateMap] = useState<Record<string, SyncStateMeta>>({});
  const [pending, setPending] = useState<PendingSyncOp[]>([]);

  useEffect(() => {
    let active = true;

    void syncStateItem.getValue().then((v) => {
      if (active) setStateMap(v);
    });
    void pendingSyncOpsItem.getValue().then((v) => {
      if (active) setPending(v);
    });

    const unwatchSyncState = storage.watch<Record<string, SyncStateMeta>>(
      "local:trail_sync_state",
      (next) => {
        if (active && next) setStateMap(next);
      },
    );
    const unwatchPending = storage.watch<PendingSyncOp[]>(
      "local:trail_pending_sync_ops",
      (next) => {
        if (active && next) setPending(next);
      },
    );
    const removeStatusListener = onExtensionMessage(EXTENSION_MESSAGE.SYNC_STATUS, ({ data }) => {
      if (active) setStatus(data.status);
    });

    return () => {
      active = false;
      unwatchSyncState();
      unwatchPending();
      removeStatusListener();
    };
  }, []);

  const entries = Object.values(stateMap);
  const syncedTreeCount = entries.filter((m) => m.lastSyncedAt !== null).length;
  const lastSyncedAt =
    entries
      .map((m) => m.lastSyncedAt)
      .filter((v): v is string => v !== null)
      .sort()
      .at(-1) ?? null;

  return {
    status,
    syncedTreeCount,
    pendingOpCount: pending.length,
    lastSyncedAt,
  };
}
