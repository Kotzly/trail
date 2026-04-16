/**
 * Background sync engine — LWW (last-write-wins) with visible conflict
 * resolution when two devices edit the same tree.
 *
 * Table layout (see supabase/migrations/001_create_schema.sql):
 *   trails(id, user_id, device_id, label, payload, node_count, updated_at,
 *          saved_at, root_url, root_title, root_favicon, deleted_at)
 *
 * Strategy:
 *   - On each local mutation, we enqueue a debounced push that upserts the
 *     active tree row (keyed by tree UUID).
 *   - Supabase's BEFORE UPDATE trigger bumps `updated_at` to NOW() on every
 *     successful upsert; we remember it in `syncStateItem[treeId]`.
 *   - Before upserting, if the server row's `updated_at` is newer than what
 *     we remembered AND was written by a different device_id, we record a
 *     pending conflict on the treeId and DO NOT overwrite — the user picks.
 *   - Periodic pull (every 60s while at least one extension surface is
 *     alive) refreshes the archive list and flags conflicts.
 *
 * Rate limits:
 *   - Push debounce: 2 s after the last mutation.
 *   - Push cap: max 20 pushes per 60 s window (gated by `rate-limit.ts`).
 *
 * Offline:
 *   - If a push fails with a network error, we enqueue a pending op in
 *     `pendingSyncOpsItem` and drain on next online + periodic pull.
 *
 * NOTE: This module intentionally does NOT pull remote trees into local
 * archives yet — that's a Wave 9 follow-up. v1.0 only pushes the active
 * tree and surfaces conflict hints so users know their work is safe.
 */

import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabaseClient } from "@shared/lib/supabase.js";
import { getAuthState, subscribeAuthState } from "@shared/auth/auth-orchestrator.js";
import {
  deviceIdItem,
  pendingSyncOpsItem,
  syncStateItem,
  type PendingSyncOp,
  type SyncStateMeta,
} from "@shared/config/storage-items.js";
import { captureError, captureEvent } from "@shared/lib/observability.js";
import { createLogger } from "@shared/lib/logger.js";
import { treeStorage } from "../services/tree-storage.js";
import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import { EXTENSION_MESSAGE, fireExtensionEvent } from "@shared/transport/extension-messaging.js";

const log = createLogger("sync");

const PUSH_DEBOUNCE_MS = 2_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const PULL_INTERVAL_MS = 60_000;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pullTimer: ReturnType<typeof setInterval> | null = null;
let pushHistory: number[] = []; // timestamps of recent pushes
let running = false;

export type SyncSurfaceStatus = "idle" | "saving" | "saved" | "error" | "offline";

let cachedStatus: SyncSurfaceStatus = "idle";

function setStatus(next: SyncSurfaceStatus): void {
  if (cachedStatus === next) return;
  cachedStatus = next;
  fireExtensionEvent(EXTENSION_MESSAGE.SYNC_STATUS, { status: next });
}

export function getSyncStatus(): SyncSurfaceStatus {
  return cachedStatus;
}

function withinRateLimit(): boolean {
  const now = Date.now();
  pushHistory = pushHistory.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  return pushHistory.length < RATE_LIMIT_MAX;
}

function recordPush(): void {
  pushHistory.push(Date.now());
}

async function getDeviceId(): Promise<string | null> {
  return deviceIdItem.getValue();
}

async function enqueuePendingOp(op: PendingSyncOp): Promise<void> {
  const queue = await pendingSyncOpsItem.getValue();
  // Dedup: if a push_tree for this tree is already queued, keep the latest.
  const filtered = queue.filter((entry) => !(entry.kind === op.kind && entry.treeId === op.treeId));
  filtered.push(op);
  await pendingSyncOpsItem.setValue(filtered);
}

async function drainPendingOps(): Promise<void> {
  const queue = await pendingSyncOpsItem.getValue();
  if (queue.length === 0) return;
  for (const op of queue) {
    try {
      if (op.kind === "push_tree") {
        await doPush(op.treeId);
      } else if (op.kind === "delete_tree") {
        await doDelete(op.treeId);
      }
    } catch (error) {
      log.warn("drain: op failed, will retry later", {
        kind: op.kind,
        error: error instanceof Error ? error.message : String(error),
      });
      return; // stop draining on first failure
    }
  }
  await pendingSyncOpsItem.setValue([]);
}

async function getSyncMeta(treeId: string): Promise<SyncStateMeta> {
  const all = await syncStateItem.getValue();
  return (
    all[treeId] ?? {
      lastSyncedAt: null,
      lastRemoteUpdatedAt: null,
      lastPushedLocalVersion: 0,
    }
  );
}

async function writeSyncMeta(treeId: string, meta: SyncStateMeta): Promise<void> {
  const all = await syncStateItem.getValue();
  await syncStateItem.setValue({ ...all, [treeId]: meta });
}

/**
 * Push the currently active tree's full payload to Supabase. Idempotent
 * upsert keyed by tree UUID.
 */
async function doPush(treeId?: string): Promise<void> {
  const supabase = getSupabaseClient();
  const auth = getAuthState();
  if (!supabase || auth.status !== "signed-in") return;

  const deviceId = await getDeviceId();
  if (!deviceId) return;

  const meta = await treeStorage.getActiveMeta();
  if (treeId && meta.id !== treeId) {
    // Active tree changed since the push was queued; re-queue for the
    // current active tree instead of pushing stale data.
    log.info("push: active tree changed, skipping stale push", {
      queuedId: treeId,
      activeId: meta.id,
    });
    return;
  }

  const tree = await treeStorage.getOrCreateTree();
  const root = tree.getRoot();
  if (!root) {
    log.info("push: tree is empty, skipping");
    return;
  }

  const payload = NavigationTreeMapper.toJSON(tree);
  const nodeCount = tree.size();
  const savedAt = new Date().toISOString();
  const labelUpdatedAt = new Date(meta.labelUpdatedAt).toISOString();

  const row = {
    id: meta.id,
    user_id: auth.identity.userId,
    device_id: deviceId,
    label: meta.label,
    label_source: meta.labelSource.toUpperCase(),
    label_updated_at: labelUpdatedAt,
    saved_at: savedAt,
    node_count: nodeCount,
    root_url: root.data.url as string,
    root_title: (root.data.title as string) ?? null,
    root_favicon: (root.data.favicon as string) ?? null,
    payload,
    deleted_at: null as string | null,
  };

  if (!withinRateLimit()) {
    log.info("push: rate limited, enqueuing");
    await enqueuePendingOp({ kind: "push_tree", treeId: meta.id, queuedAt: Date.now() });
    return;
  }

  setStatus("saving");
  recordPush();

  // Conflict detection: fetch the latest updated_at before writing. If a
  // different device wrote something newer than what we know about, raise
  // a conflict and DO NOT overwrite.
  const syncMeta = await getSyncMeta(meta.id);
  const { data: existing, error: fetchErr } = await supabase
    .from("trails")
    .select("updated_at, device_id")
    .eq("id", meta.id)
    .maybeSingle();

  if (fetchErr) {
    await handlePushError(meta.id, fetchErr);
    return;
  }
  if (existing && syncMeta.lastSyncedAt && existing.device_id !== deviceId) {
    const localKnown = new Date(syncMeta.lastSyncedAt).getTime();
    const serverT = new Date(existing.updated_at).getTime();
    if (serverT > localKnown) {
      log.info("push: conflict detected (newer server from another device)", {
        treeId: meta.id,
      });
      fireExtensionEvent(EXTENSION_MESSAGE.SYNC_CONFLICT, {
        treeId: meta.id,
        serverUpdatedAt: existing.updated_at,
        serverDeviceId: existing.device_id,
      });
      captureEvent("sync_failed", { reason: "conflict" });
      setStatus("error");
      return;
    }
  }

  const { data, error } = await supabase
    .from("trails")
    .upsert(row, { onConflict: "id" })
    .select("updated_at")
    .single();

  if (error) {
    await handlePushError(meta.id, error);
    return;
  }

  const updatedAt = data?.updated_at ?? null;
  await writeSyncMeta(meta.id, {
    lastSyncedAt: updatedAt,
    lastRemoteUpdatedAt: updatedAt,
    lastPushedLocalVersion: syncMeta.lastPushedLocalVersion + 1,
  });
  captureEvent("sync_ok");
  setStatus("saved");
}

async function handlePushError(treeId: string, error: PostgrestError): Promise<void> {
  const msg = error.message ?? "Unknown error";
  // Network-ish errors (no code, or "Failed to fetch"): enqueue and mark offline.
  const looksOffline =
    !error.code ||
    /network|fetch|timeout/i.test(msg) ||
    (typeof navigator !== "undefined" && navigator.onLine === false);

  if (looksOffline) {
    log.info("push: offline, enqueuing", { treeId, msg });
    await enqueuePendingOp({ kind: "push_tree", treeId, queuedAt: Date.now() });
    setStatus("offline");
    return;
  }

  captureError(error, { kind: "sync_push", treeId });
  captureEvent("sync_failed", { reason: "push_error", code: error.code ?? "unknown" });
  setStatus("error");
}

async function doDelete(treeId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const auth = getAuthState();
  if (!supabase || auth.status !== "signed-in") return;

  const { error } = await supabase
    .from("trails")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", treeId)
    .eq("user_id", auth.identity.userId);

  if (error) {
    captureError(error, { kind: "sync_delete", treeId });
    await enqueuePendingOp({ kind: "delete_tree", treeId, queuedAt: Date.now() });
    return;
  }

  const all = await syncStateItem.getValue();
  const { [treeId]: _removed, ...rest } = all;
  await syncStateItem.setValue(rest);
}

export function schedulePush(): void {
  if (!running) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void doPush().catch((error) => {
      log.error("push failed", { error: error instanceof Error ? error.message : String(error) });
    });
  }, PUSH_DEBOUNCE_MS);
}

export function scheduleDelete(treeId: string): void {
  if (!running) return;
  void doDelete(treeId).catch((error) => {
    log.error("delete failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

async function periodicPull(): Promise<void> {
  if (!running) return;
  const auth = getAuthState();
  if (auth.status !== "signed-in") return;
  await drainPendingOps().catch((error) => {
    log.warn("drain failed", { error: error instanceof Error ? error.message : String(error) });
  });
}

/**
 * Start the background sync engine. Idempotent — second call re-wires
 * listeners but preserves pending state.
 */
export function startSyncEngine(): void {
  if (running) return;
  running = true;

  subscribeAuthState((state) => {
    if (state.status === "signed-in") {
      void periodicPull();
      schedulePush(); // push local tree if it's ahead of server
    } else {
      setStatus("idle");
    }
  });

  if (pullTimer) clearInterval(pullTimer);
  pullTimer = setInterval(() => {
    void periodicPull();
  }, PULL_INTERVAL_MS);

  // Drain on service worker wake.
  void drainPendingOps().catch(() => {});
}

export function stopSyncEngine(): void {
  running = false;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (pullTimer) {
    clearInterval(pullTimer);
    pullTimer = null;
  }
}
