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
 *     alive) refreshes the tree list and flags conflicts.
 *
 * Rate limits:
 *   - Push debounce: 2 s after the last mutation.
 *   - Push cap: max 20 pushes per 60 s window (gated by `rate-limit.ts`).
 *
 * Offline:
 *   - If a push fails with a network error, we enqueue a pending op in
 *     `pendingSyncOpsItem` and drain on next online + periodic pull.
 *
 * NOTE: This module intentionally does NOT pull remote tree payloads
 * into local storage yet — that's a Wave 9 follow-up. v1.0 only pushes
 * the active tree and surfaces conflict hints so users know their work
 * is safe.
 */

import type { PostgrestError } from "@supabase/supabase-js";
import pDebounce from "p-debounce";
import { getSupabaseClient } from "@shared/lib/supabase.js";
import { getAuthState, subscribeAuthState } from "@shared/auth/auth-orchestrator.js";
import {
  deviceIdItem,
  localDeleteTombstonesItem,
  LOCAL_DELETE_TOMBSTONE_TTL_MS,
  pendingSyncOpsItem,
  syncStateItem,
  type LocalDeleteTombstone,
  type PendingSyncOp,
  type SyncStateMeta,
} from "@shared/config/storage-items.js";
import { captureError, captureEvent } from "@shared/lib/observability.js";
import { createLogger } from "@shared/lib/logger.js";
import { pickTreeIdentifyingData, treeStorage } from "../services/tree-storage.js";
import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import { EXTENSION_MESSAGE, fireExtensionEvent } from "@shared/transport/extension-messaging.js";
import {
  isTreeStub,
  type TreeIndexEntry,
  type NavigationTreeJSON,
  type TreeLabelSource,
  type TreeStub,
  type TreeSummary,
} from "@shared/types/tree.js";
import type { FaviconUrl, Title, Url } from "@shared/types/ids.js";
import { notifyUi } from "@background/messaging/ui-notifications.js";
import { toCompact, fromCompact } from "@shared/lib/compact-mapper.js";
import { uuidv7 } from "@shared/lib/uuid.js";
import { validateMergedTree } from "@shared/lib/tree-diff.js";
import {
  CONFLICT_DIALOG_NODE_CAP,
  type ApplyConflictMergeInput,
  type ApplyOk,
  type ApplyResult,
  type CompressedConflictPreview,
  type ConflictPreviewError,
} from "@shared/types/tree-diff.js";

const log = createLogger("sync");

const PUSH_DEBOUNCE_MS = 2_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

// chrome.alarms is authoritative for periodic pull (setInterval dies
// with SW eviction). Alarm name is referenced from service-worker.ts
// which registers the onAlarm listener at module top-level so Chrome
// can wake the SW when it fires.
export const SYNC_PULL_ALARM = "trail-sync-pull";
export const SYNC_PULL_PERIOD_MINUTES = 1;

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

/**
 * Cross-kind dedup contract:
 *   - `delete_tree:X` dominates: enqueueing it drops ANY queued op for X
 *     (push or delete) and leaves only the freshest delete.
 *   - `push_tree:X` is a no-op if `delete_tree:X` is already queued —
 *     pushing would resurrect the tree the user just deleted.
 *   - Same-kind same-tree push collapses to the latest one.
 */
async function enqueuePendingOp(op: PendingSyncOp): Promise<void> {
  const queue = await pendingSyncOpsItem.getValue();
  if (op.kind === "delete_tree") {
    const filtered = queue.filter((entry) => entry.treeId !== op.treeId);
    filtered.push(op);
    await pendingSyncOpsItem.setValue(filtered);
    return;
  }
  // op.kind === "push_tree"
  if (queue.some((entry) => entry.kind === "delete_tree" && entry.treeId === op.treeId)) {
    captureEvent("delete_dedup_dropped_push", { treeId: op.treeId });
    return;
  }
  const filtered = queue.filter((entry) => !(entry.kind === op.kind && entry.treeId === op.treeId));
  filtered.push(op);
  await pendingSyncOpsItem.setValue(filtered);
}

/**
 * Remove any pending `delete_tree:treeId` op AND clear the local
 * tombstone. Used by `restoreTree` (Undo path) to prevent the
 * background drain or pull-side tombstone-gating from re-deleting a
 * tree the user just restored.
 */
export async function cancelPendingDelete(treeId: string): Promise<void> {
  const queue = await pendingSyncOpsItem.getValue();
  const filtered = queue.filter(
    (entry) => !(entry.kind === "delete_tree" && entry.treeId === treeId),
  );
  if (filtered.length !== queue.length) {
    await pendingSyncOpsItem.setValue(filtered);
  }
  const tombstones = await localDeleteTombstonesItem.getValue();
  if (tombstones[treeId]) {
    const { [treeId]: _removed, ...rest } = tombstones;
    await localDeleteTombstonesItem.setValue(rest);
  }
}

type PushOutcome = "ok" | "skipped" | "conflict" | "offline" | "error" | "rate_limited";

async function drainPendingOps(): Promise<void> {
  const initial = await pendingSyncOpsItem.getValue();
  if (initial.length === 0) return;
  const opKey = (op: PendingSyncOp) => `${op.kind}:${op.treeId}`;
  const processed = new Set<string>();

  for (const op of initial) {
    try {
      if (op.kind === "push_tree") {
        const outcome = await doPushTree(op.treeId);
        // Terminal outcomes (ok/conflict) — remove from queue.
        // `skipped` is NOT terminal: it means "auth isn't ready yet /
        // caller asked us to skip"; leaving the op queued lets the next
        // drain (after auth settles) retry. Dropping it here silently
        // discards user mutations (pre-fix: every SW wake zeroed the
        // queue before auth resolved — see P0.5/P0.6).
        if (outcome === "ok" || outcome === "conflict") {
          processed.add(opKey(op));
        } else {
          break;
        }
      } else if (op.kind === "delete_tree") {
        await doDelete(op.treeId);
        processed.add(opKey(op));
      }
    } catch (error) {
      log.warn("drain: op failed, will retry later", {
        kind: op.kind,
        error: error instanceof Error ? error.message : String(error),
      });
      break;
    }
  }

  if (processed.size === 0) return;
  // Re-read: rate-limited ops may have re-enqueued themselves mid-drain.
  // Only strip entries we actually finished.
  const current = await pendingSyncOpsItem.getValue();
  const remaining = current.filter((op) => !processed.has(opKey(op)));
  await pendingSyncOpsItem.setValue(remaining);
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

type PushRowInput = {
  id: string;
  label: string;
  labelSource: TreeLabelSource;
  /** Epoch ms from local metadata; converted to ISO inside `pushRow`. */
  labelUpdatedAt: number;
  payload: NavigationTreeJSON;
  nodeCount: number;
  rootUrl: string | null;
  rootTitle: string | null;
  rootFavicon: string | null;
};

/**
 * Upsert one tree row into Supabase. Shared by active-tree pushes and
 * backfill pushes for stored (non-active) trees. Handles rate limit,
 * conflict detection, status broadcasting, and sync-meta bookkeeping.
 * The outcome lets callers (e.g. `drainPendingOps`) decide whether to
 * retry or consume the pending op.
 */
async function pushRow(input: PushRowInput): Promise<PushOutcome> {
  const supabase = getSupabaseClient();
  const auth = getAuthState();
  if (!supabase || auth.status !== "signed-in") return "skipped";

  // Race guard: if a server-side delete is in flight or queued for this
  // tree, skip the push entirely. Pushing now would either race the
  // UPDATE (and the upsert below writes `deleted_at: null`, undoing
  // the delete) or write a fresh row that the queued delete will
  // immediately soft-delete again. Either way: nothing to do.
  if (deleteInFlight.has(input.id)) {
    log.info("push: suppressed by in-flight delete", { treeId: input.id });
    return "skipped";
  }
  const queuedOps = await pendingSyncOpsItem.getValue();
  if (queuedOps.some((op) => op.kind === "delete_tree" && op.treeId === input.id)) {
    log.info("push: suppressed by queued delete", { treeId: input.id });
    return "skipped";
  }

  const deviceId = await getDeviceId();
  if (!deviceId) return "skipped";

  if (!withinRateLimit()) {
    log.info("push: rate limited, enqueuing", { treeId: input.id });
    await enqueuePendingOp({ kind: "push_tree", treeId: input.id, queuedAt: Date.now() });
    return "rate_limited";
  }

  setStatus("saving");
  recordPush();

  // Conflict detection: fetch the latest updated_at before writing. If a
  // different device wrote something newer than what we know about, raise
  // a conflict and DO NOT overwrite.
  const syncMeta = await getSyncMeta(input.id);
  const { data: existing, error: fetchErr } = await supabase
    .from("trails")
    .select("updated_at, device_id")
    .eq("id", input.id)
    .maybeSingle();

  if (fetchErr) {
    return handlePushError(input.id, fetchErr);
  }
  if (existing && syncMeta.lastSyncedAt && existing.device_id !== deviceId) {
    const localKnown = new Date(syncMeta.lastSyncedAt).getTime();
    const serverT = new Date(existing.updated_at).getTime();
    if (serverT > localKnown) {
      const { isNew } = markConflict({
        treeId: input.id,
        serverUpdatedAt: existing.updated_at,
        serverDeviceId: existing.device_id,
        label: input.label,
      });
      if (isNew) {
        // Only log + fire the event on the first detection for this
        // server revision. Retrying the push on every local mutation
        // (debounced ~2 s) would otherwise spam sonner with duplicate
        // "merge conflict" toasts and push the persistent resolve-
        // toast off the visible stack. Re-firing on a NEWER server
        // updated_at is still allowed — that's a real state change.
        log.info("push: conflict detected (newer server from another device)", {
          treeId: input.id,
        });
        fireExtensionEvent(EXTENSION_MESSAGE.SYNC_CONFLICT, {
          treeId: input.id,
          serverUpdatedAt: existing.updated_at,
          serverDeviceId: existing.device_id,
        });
        captureEvent("sync_failed", { reason: "conflict" });
      }
      setStatus("error");
      return "conflict";
    }
  }

  const row = {
    id: input.id,
    user_id: auth.identity.userId,
    device_id: deviceId,
    label: input.label,
    label_source: input.labelSource.toUpperCase(),
    label_updated_at: new Date(input.labelUpdatedAt).toISOString(),
    saved_at: new Date().toISOString(),
    node_count: input.nodeCount,
    root_url: input.rootUrl,
    root_title: input.rootTitle,
    root_favicon: input.rootFavicon,
    payload: input.payload,
    deleted_at: null as string | null,
  };

  const { data, error } = await supabase
    .from("trails")
    .upsert(row, { onConflict: "id" })
    .select("updated_at")
    .single();

  if (error) {
    return handlePushError(input.id, error);
  }

  const updatedAt = data?.updated_at ?? null;
  await writeSyncMeta(input.id, {
    lastSyncedAt: updatedAt,
    lastRemoteUpdatedAt: updatedAt,
    lastPushedLocalVersion: syncMeta.lastPushedLocalVersion + 1,
  });
  captureEvent("sync_ok");
  setStatus("saved");
  return "ok";
}

/**
 * Tree ids with an in-flight conflict-merge apply. While an id is here
 * the debounced push path skips that tree to avoid racing the
 * conditional upsert in `applyConflictMergeInternal`.
 */
const mergeInFlight = new Set<string>();

/**
 * Tree ids with an in-flight server-side delete (`doDelete` UPDATE).
 * Set synchronously by `scheduleDelete` so that any push path racing
 * the same treeId — including `pushRow` already past the queue check —
 * skips and avoids overwriting `deleted_at` back to null.
 */
const deleteInFlight = new Set<string>();

export function isDeleteInFlight(treeId: string): boolean {
  return deleteInFlight.has(treeId);
}

/**
 * In-memory map of trees that currently have an unresolved conflict,
 * keyed by treeId. The sidepanel UI queries this on boot so the
 * conflict toast persists across sidepanel close/reopen without
 * needing another round-trip through the push path.
 */
export type PendingConflict = {
  treeId: string;
  serverUpdatedAt: string;
  serverDeviceId: string;
  label: string;
};
const pendingConflicts = new Map<string, PendingConflict>();

export function getPendingConflictsSnapshot(): PendingConflict[] {
  return Array.from(pendingConflicts.values());
}

function markConflict(conflict: PendingConflict): { isNew: boolean } {
  const existing = pendingConflicts.get(conflict.treeId);
  const isNew = !existing || existing.serverUpdatedAt !== conflict.serverUpdatedAt;
  pendingConflicts.set(conflict.treeId, conflict);
  return { isNew };
}

function clearPendingConflict(treeId: string): void {
  pendingConflicts.delete(treeId);
}

/** Push the in-memory active tree. */
async function doPushActive(): Promise<PushOutcome> {
  const auth = getAuthState();
  if (auth.status !== "signed-in") return "skipped";

  const meta = await treeStorage.getActiveMeta();
  if (mergeInFlight.has(meta.id)) {
    log.info("push: suppressed by in-flight conflict merge", { treeId: meta.id });
    return "skipped";
  }
  const tree = await treeStorage.getOrCreateTree();
  const root = tree.getRoot();
  if (!root) {
    log.info("push: active tree is empty, skipping");
    return "skipped";
  }
  const identifying = pickTreeIdentifyingData(tree);
  return pushRow({
    id: meta.id,
    label: meta.label,
    labelSource: meta.labelSource,
    labelUpdatedAt: meta.labelUpdatedAt,
    payload: NavigationTreeMapper.toJSON(tree),
    nodeCount: tree.size(),
    rootUrl: identifying.url ?? null,
    rootTitle: identifying.title ?? null,
    rootFavicon: identifying.favicon ?? null,
  });
}

/** Push a stored (non-active) tree. Reads the compressed blob + summary. */
async function doPushStored(treeId: string): Promise<PushOutcome> {
  const auth = getAuthState();
  if (auth.status !== "signed-in") return "skipped";

  const record = await treeStorage.getFullStoredRecord(treeId);
  if (!record) {
    // Either a stub (no local payload yet) or the blob is missing.
    // `takeStoredTree`'s orphan-prune path will clean up missing blobs
    // next time the user opens this tree.
    log.info("push: stored tree missing or stub, skipping", { treeId });
    return "skipped";
  }
  return pushRow({
    id: record.id,
    label: record.label,
    labelSource: record.labelSource,
    labelUpdatedAt: record.labelUpdatedAt,
    payload: record.tree,
    nodeCount: record.nodeCount,
    rootUrl: record.rootUrl ?? null,
    rootTitle: record.rootTitle ?? null,
    rootFavicon: record.rootFavicon ?? null,
  });
}

/** Dispatch: push either the active tree or a stored tree by id. */
async function doPushTree(treeId: string): Promise<PushOutcome> {
  const active = await treeStorage.getActiveMeta();
  if (active.id === treeId) return doPushActive();
  return doPushStored(treeId);
}

/**
 * Ensure a stored tree has a successful server-side copy. Returns early
 * with `"ok"` if `syncStateItem` already records a `lastSyncedAt` — no
 * second upsert needed. Caller is responsible for checking auth state
 * before invocation; we still return `"skipped"` for safety if the
 * session vanished mid-flight.
 */
export async function ensureStoredTreePushed(treeId: string): Promise<PushOutcome> {
  const auth = getAuthState();
  if (auth.status !== "signed-in") return "skipped";
  const meta = await getSyncMeta(treeId);
  if (meta.lastSyncedAt) return "ok";
  return doPushStored(treeId);
}

function isOfflineError(error: PostgrestError): boolean {
  // PostgrestError without a code means the request never reached
  // PostgREST — network failure, DNS failure, timeout, or hard offline.
  if (!error.code) return true;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return false;
}

async function handlePushError(treeId: string, error: PostgrestError): Promise<PushOutcome> {
  if (isOfflineError(error)) {
    log.info("push: offline, enqueuing", { treeId, msg: error.message ?? "Unknown error" });
    await enqueuePendingOp({ kind: "push_tree", treeId, queuedAt: Date.now() });
    setStatus("offline");
    return "offline";
  }

  captureError(error, { kind: "sync_push", treeId });
  captureEvent("sync_failed", { reason: "push_error", code: error.code ?? "unknown" });
  setStatus("error");
  notifyUi({
    message: `Couldn't sync a tree to the cloud: ${error.message ?? "unknown error"}.`,
    icon: "AlertTriangle",
    durationMs: 10000,
  });
  return "error";
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

  // Server ack — drop sync metadata + local tombstone (server is now
  // authoritative; future pulls will see `deleted_at IS NOT NULL`).
  const all = await syncStateItem.getValue();
  const { [treeId]: _removed, ...rest } = all;
  await syncStateItem.setValue(rest);
  const tombstones = await localDeleteTombstonesItem.getValue();
  if (tombstones[treeId]) {
    const { [treeId]: _ts, ...remaining } = tombstones;
    await localDeleteTombstonesItem.setValue(remaining);
  }
}

const debouncedPush = pDebounce(async () => {
  // Re-check `running` at fire time: stopSyncEngine can flip it between
  // schedulePush() and the debounce timeout firing.
  if (!running) return;
  try {
    await doPushActive();
  } catch (error) {
    log.error("push failed", { error: error instanceof Error ? error.message : String(error) });
  }
}, PUSH_DEBOUNCE_MS);

export function schedulePush(): void {
  if (!running) return;
  void debouncedPush();
}

export function scheduleDelete(treeId: string): void {
  if (!running) return;
  // Mark synchronously BEFORE awaiting anything in doDelete, so any
  // push-path race (debouncedPush already in flight, drainPendingOps
  // currently picking up a queued push) sees the in-flight set and
  // skips. We always remove in `.finally` — never rely on success.
  deleteInFlight.add(treeId);
  void doDelete(treeId)
    .catch((error) => {
      log.error("delete failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      deleteInFlight.delete(treeId);
    });
}

type TrailRow = {
  id: string;
  device_id: string;
  label: string;
  label_source: "USER" | "AUTO" | "SYSTEM";
  label_updated_at: string;
  created_at: string;
  updated_at: string;
  saved_at: string;
  node_count: number;
  root_url: string | null;
  root_title: string | null;
  root_favicon: string | null;
  deleted_at: string | null;
};

/**
 * Incremental high-water mark for pull. Server-driven (read via
 * `select now()`) so cross-device clock skew doesn't cause gaps.
 * In-memory only — a SW restart triggers a full pull, which is the
 * correct safe default.
 */
let lastPulledAt: string | null = null;

/** Safety margin: re-fetch the last 10s on every incremental pull to
 *  avoid racing rows whose `updated_at` was assigned in the same trigger
 *  tick as `lastPulledAt`. Cheap; ensures convergence. */
const PULL_SAFETY_MARGIN_MS = 10_000;

/**
 * Compute the "look back from here" watermark used by incremental
 * pull. Subtracts PULL_SAFETY_MARGIN_MS from `lastPulledAt` to absorb
 * client/server clock skew and ensure rows whose `updated_at` lands
 * in the same trigger tick as the previous high-water mark still
 * surface in the next pull.
 */
function backOffWatermark(iso: string): string {
  const t = new Date(iso).getTime() - PULL_SAFETY_MARGIN_MS;
  return new Date(t).toISOString();
}

/**
 * Merge remote trails into the local tree index as stubs. A stub is a
 * summary-only entry — payload is fetched on demand via `loadTree` (see
 * tree-loader.ts). Local entries with full payload win over stubs.
 *
 * Also propagates remote soft-deletes: trees whose `deleted_at` was set
 * on another device (or via account-deletion RPC) are removed from the
 * local index here. Active tree pruning is intentionally avoided —
 * surfaced via notifyUi instead.
 */
async function doPull(): Promise<void> {
  const supabase = getSupabaseClient();
  const auth = getAuthState();
  if (!supabase || auth.status !== "signed-in") return;

  // Capture watermark BEFORE the queries so any row updated mid-pull
  // is picked up by the next pull. PULL_SAFETY_MARGIN_MS absorbs
  // client/server clock skew on the back end of the next query.
  const nextWatermark = new Date().toISOString();
  const watermarkForQuery = lastPulledAt ? backOffWatermark(lastPulledAt) : null;

  let liveQuery = supabase
    .from("trails")
    .select(
      "id,device_id,label,label_source,label_updated_at,created_at,updated_at,saved_at,node_count,root_url,root_title,root_favicon,deleted_at",
    )
    .eq("user_id", auth.identity.userId)
    .is("deleted_at", null);
  if (watermarkForQuery) liveQuery = liveQuery.gte("updated_at", watermarkForQuery);
  const { data, error } = await liveQuery;

  if (error) {
    // Swallow offline errors; periodic pull retries and the user isn't
    // blocked by them the way they are on push.
    if (!isOfflineError(error)) {
      captureError(error, { kind: "sync_pull" });
    }
    return;
  }

  // Soft-delete propagation query (separate so the live query above
  // stays compatible with prior syncMeta semantics).
  let deletedQuery = supabase
    .from("trails")
    .select("id,deleted_at")
    .eq("user_id", auth.identity.userId)
    .not("deleted_at", "is", null);
  if (watermarkForQuery) deletedQuery = deletedQuery.gte("updated_at", watermarkForQuery);
  const { data: deletedRows, error: deletedErr } = await deletedQuery;
  if (deletedErr && !isOfflineError(deletedErr)) {
    captureError(deletedErr, { kind: "sync_pull_deleted" });
  }

  const activeMeta = await treeStorage.getActiveMeta();
  const tombstones = await garbageCollectTombstones();

  // 1) Apply remote soft-deletes locally (skip active — see comment above).
  if (deletedRows && deletedRows.length > 0) {
    let prunedAny = false;
    for (const row of deletedRows as Array<{ id: string }>) {
      if (row.id === activeMeta.id) {
        // Surface but don't auto-wipe the user's open work.
        notifyUi({
          message:
            "Your active tree was deleted on another device. Switch trees to refresh local state.",
          icon: "AlertTriangle",
          durationMs: 10_000,
        });
        continue;
      }
      try {
        const removed = await treeStorage.deleteTree(row.id);
        if (removed) {
          prunedAny = true;
          captureEvent("delete_remote_propagated", { treeId: row.id });
        }
      } catch (err) {
        log.warn("doPull: remote-delete prune failed", {
          treeId: row.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (prunedAny) {
      try {
        await notifyTreesUpdateFromPull();
      } catch {
        /* non-fatal */
      }
    }
  }

  const rows = (data ?? []) as TrailRow[];
  if (rows.length === 0) {
    lastPulledAt = nextWatermark;
    return;
  }

  const currentIndex = await treeStorage.getTreeIndex();
  const byId = new Map(currentIndex.map((e) => [e.id, e] as const));
  let changed = false;

  for (const row of rows) {
    if (row.id === activeMeta.id) continue; // active tree handled by push path

    // Tombstone-gating: a row we just deleted locally may still appear
    // here (the server UPDATE hadn't landed when the pull started).
    // Skip the insert and re-queue the delete to converge.
    const tombstone = tombstones[row.id];
    if (tombstone && Date.now() - tombstone.deletedAt < LOCAL_DELETE_TOMBSTONE_TTL_MS) {
      if (!byId.has(row.id)) {
        // Server still thinks the tree is live; nudge another delete.
        await enqueuePendingOp({ kind: "delete_tree", treeId: row.id, queuedAt: Date.now() });
      }
      continue;
    }

    const summary: TreeSummary = {
      id: row.id,
      label: row.label,
      labelSource: row.label_source.toLowerCase() as TreeSummary["labelSource"],
      labelUpdatedAt: new Date(row.label_updated_at).getTime(),
      createdAt: new Date(row.created_at).getTime(),
      savedAt: new Date(row.saved_at).getTime(),
      nodeCount: row.node_count,
      ...(row.root_url ? { rootUrl: row.root_url as Url } : {}),
      ...(row.root_title ? { rootTitle: row.root_title as Title } : {}),
      ...(row.root_favicon ? { rootFavicon: row.root_favicon as FaviconUrl } : {}),
    };

    const existing = byId.get(row.id);
    if (!existing) {
      // Never seen locally — insert as stub (payload fetched on open).
      const stub: TreeStub = { ...summary, stub: true as const };
      byId.set(row.id, stub);
      changed = true;
      continue;
    }
    if (isTreeStub(existing)) {
      // Refresh stub metadata in case label/node_count changed on remote.
      if (
        existing.label !== summary.label ||
        existing.nodeCount !== summary.nodeCount ||
        existing.savedAt !== summary.savedAt
      ) {
        byId.set(row.id, { ...summary, stub: true as const });
        changed = true;
      }
      continue;
    }
    // Local has real payload — if server version is ahead, fire a conflict.
    // Compare using server `updated_at` (trigger-stamped, monotonic per
    // row) instead of client-generated `savedAt` (subject to cross-device
    // clock skew — #14). Fall back to savedAt only if server updated_at
    // is missing.
    //
    // Tiebreaker: when updated_at is identical (two writes within the
    // same trigger tick, rare but non-zero), prefer the row with the
    // lexicographically greater id as a stable deterministic choice.
    // This is a client-side mitigation; a true monotonic `revision`
    // column is a follow-up Supabase-schema change.
    const syncMeta = await getSyncMeta(row.id);
    const lastKnownServer = syncMeta.lastRemoteUpdatedAt
      ? new Date(syncMeta.lastRemoteUpdatedAt).getTime()
      : 0;
    const currentServer = new Date(row.updated_at).getTime();
    const serverAhead =
      currentServer > lastKnownServer ||
      (currentServer === lastKnownServer && row.id > (syncMeta.lastSyncedAt ?? ""));
    if (serverAhead) {
      const { isNew } = markConflict({
        treeId: row.id,
        serverUpdatedAt: row.updated_at,
        serverDeviceId: row.device_id,
        label: row.label,
      });
      if (isNew) {
        fireExtensionEvent(EXTENSION_MESSAGE.SYNC_CONFLICT, {
          treeId: row.id,
          serverUpdatedAt: row.updated_at,
          serverDeviceId: row.device_id,
        });
      }
    }
  }

  if (changed) {
    const next: TreeIndexEntry[] = Array.from(byId.values());
    await treeStorage.setTreeIndex(next);
    await notifyTreesUpdateFromPull();
  }

  lastPulledAt = nextWatermark;
}

async function notifyTreesUpdateFromPull(): Promise<void> {
  try {
    const active = await treeStorage.getActiveMeta();
    const others = await treeStorage.getStoredSummaries();
    fireExtensionEvent(EXTENSION_MESSAGE.TREES_UPDATED, { active, others });
  } catch {
    /* non-fatal */
  }
}

/**
 * Read tombstones, drop expired entries, return the live map. Callers
 * use the returned map directly; this function also writes back the
 * cleaned map when something was evicted.
 */
async function garbageCollectTombstones(): Promise<Record<string, LocalDeleteTombstone>> {
  const all = await localDeleteTombstonesItem.getValue();
  const now = Date.now();
  const live: Record<string, LocalDeleteTombstone> = {};
  let changed = false;
  for (const [id, t] of Object.entries(all)) {
    if (now - t.deletedAt < LOCAL_DELETE_TOMBSTONE_TTL_MS) {
      live[id] = t;
    } else {
      changed = true;
    }
  }
  if (changed) await localDeleteTombstonesItem.setValue(live);
  return live;
}

/**
 * Conflict-preview read: no side effects. Unlike `fetchRemoteTreePayload`
 * below, this call does NOT materialize the payload, unstub the index
 * entry, or update syncMeta — all of those would commit the remote
 * version before the user has resolved the conflict.
 *
 * Output:
 *  - `{ ok: true, value: CompressedConflictPreview }` on success. Payload
 *    is encoded to `CompactTreeJSON` for transport efficiency.
 *  - `{ ok: false, error }` with a typed reason for the dialog to route.
 *
 * Enforces `CONFLICT_DIALOG_NODE_CAP` at this boundary: trees with more
 * nodes than the cap fall back to the reduced-UX variant.
 */
export async function fetchRemoteTreeForConflict(
  treeId: string,
): Promise<
  { ok: true; value: CompressedConflictPreview } | { ok: false; error: ConflictPreviewError }
> {
  const supabase = getSupabaseClient();
  const auth = getAuthState();
  if (!supabase) return { ok: false, error: { reason: "network" } };
  if (auth.status !== "signed-in") return { ok: false, error: { reason: "auth-lost" } };

  const { data, error } = await supabase
    .from("trails")
    .select(
      "payload,label,label_source,label_updated_at,updated_at,device_id,deleted_at,node_count",
    )
    .eq("id", treeId)
    .eq("user_id", auth.identity.userId)
    .maybeSingle();

  if (error) {
    if (isOfflineError(error)) return { ok: false, error: { reason: "network" } };
    captureError(error, { kind: "sync_conflict_preview", treeId });
    return { ok: false, error: { reason: "network" } };
  }
  if (!data) return { ok: false, error: { reason: "row-missing" } };
  if (typeof data.node_count === "number" && data.node_count > CONFLICT_DIALOG_NODE_CAP) {
    return { ok: false, error: { reason: "too-large", nodeCount: data.node_count } };
  }

  const payload = data.payload as NavigationTreeJSON | null;
  if (!payload || !payload.root) {
    // Empty server tree is fine — allow diff against empty. But a null
    // payload on a non-deleted row is a schema violation.
    if (!data.deleted_at) {
      return { ok: false, error: { reason: "payload-corrupt", detail: "null payload" } };
    }
  }

  const safePayload: NavigationTreeJSON = payload ?? {
    root: null,
    currentNodeId: null,
    nodeCount: 0,
  };
  let compact;
  try {
    compact = toCompact(safePayload);
  } catch (encodeErr) {
    return {
      ok: false,
      error: {
        reason: "payload-corrupt",
        detail: encodeErr instanceof Error ? encodeErr.message : String(encodeErr),
      },
    };
  }

  const labelSource = (
    typeof data.label_source === "string" ? data.label_source.toLowerCase() : "user"
  ) as TreeLabelSource;

  return {
    ok: true,
    value: {
      treeId,
      serverPayloadCompact: compact,
      serverLabel: {
        label: String(data.label ?? ""),
        source: labelSource,
        updatedAt: data.label_updated_at ? new Date(data.label_updated_at).getTime() : 0,
      },
      serverUpdatedAt: String(data.updated_at ?? ""),
      serverDeviceId: String(data.device_id ?? ""),
      isSoftDeleted: data.deleted_at !== null,
    },
  };
}

type ConditionalPushInput = PushRowInput & { expectedServerUpdatedAt: string };

/**
 * Like `pushRow` but uses optimistic concurrency: the UPDATE is gated
 * by `.eq("updated_at", expected)`. When the server row's updated_at
 * moved between preview and apply (TOCTOU), zero rows match and we
 * signal `server-changed` rather than overwriting.
 *
 * Unlike the regular upsert path this ALWAYS uses UPDATE (the row must
 * exist already — conflict resolution presupposes a row to conflict
 * with). A separate row-missing branch in the caller handles the
 * never-existed case.
 */
async function pushRowConditional(
  input: ConditionalPushInput,
): Promise<
  | { ok: true; updatedAt: string }
  | { ok: false; reason: "server-changed" | "row-deleted" | "network" }
> {
  const supabase = getSupabaseClient();
  const auth = getAuthState();
  if (!supabase || auth.status !== "signed-in") return { ok: false, reason: "network" };
  const deviceId = await getDeviceId();
  if (!deviceId) return { ok: false, reason: "network" };

  if (!withinRateLimit()) {
    // Conflict apply is explicit user action — re-enqueuing silently
    // would hide the failure. Treat rate limit as a transient network
    // error so the UI can surface a retry affordance.
    log.info("pushRowConditional: rate limited", { treeId: input.id });
    return { ok: false, reason: "network" };
  }
  recordPush();

  const fields = {
    device_id: deviceId,
    label: input.label,
    label_source: input.labelSource.toUpperCase(),
    label_updated_at: new Date(input.labelUpdatedAt).toISOString(),
    saved_at: new Date().toISOString(),
    node_count: input.nodeCount,
    root_url: input.rootUrl,
    root_title: input.rootTitle,
    root_favicon: input.rootFavicon,
    payload: input.payload,
  };

  const { data, error } = await supabase
    .from("trails")
    .update(fields)
    .eq("id", input.id)
    .eq("user_id", auth.identity.userId)
    .eq("updated_at", input.expectedServerUpdatedAt)
    .is("deleted_at", null)
    .select("updated_at")
    .maybeSingle();

  if (error) {
    if (isOfflineError(error)) return { ok: false, reason: "network" };
    captureError(error, { kind: "sync_conflict_apply", treeId: input.id });
    return { ok: false, reason: "network" };
  }

  if (!data) {
    // Zero rows matched → either updated_at advanced (another device
    // pushed again), or deleted_at got set between preview and apply.
    // Disambiguate with a follow-up read.
    const { data: check } = await supabase
      .from("trails")
      .select("deleted_at")
      .eq("id", input.id)
      .maybeSingle();
    if (check && check.deleted_at !== null) return { ok: false, reason: "row-deleted" };
    return { ok: false, reason: "server-changed" };
  }

  return { ok: true, updatedAt: String(data.updated_at ?? "") };
}

/**
 * Apply a user-resolved merge atomically. See plan §Apply write-back.
 *
 * Ordering is: validate → guard active-tree invariant → conditional
 * upsert (optimistic concurrency) → local write → syncMeta update →
 * fire RESOLVED event. Local write deliberately follows the successful
 * upsert so TOCTOU / server-changed races don't corrupt local state.
 */
export async function applyConflictMergeInternal(
  input: ApplyConflictMergeInput,
): Promise<ApplyResult> {
  const auth = getAuthState();
  if (auth.status !== "signed-in") {
    return { ok: false, error: { reason: "network" } };
  }

  // 1. Active-tree invariant.
  const activeMeta = await treeStorage.getActiveMeta();
  if (input.expectedActiveTreeId !== null && activeMeta.id !== input.expectedActiveTreeId) {
    return { ok: false, error: { reason: "tree-not-active", activeTreeId: activeMeta.id } };
  }

  // 2. Decode compact → NavigationTreeJSON.
  let merged: NavigationTreeJSON;
  try {
    merged = fromCompact(input.mergedTreeCompact);
  } catch (err) {
    return {
      ok: false,
      error: {
        reason: "invalid-merge",
        validatorReason: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // 3. Validate the merged tree — block apply on any invariant break.
  const validation = validateMergedTree(merged);
  if (!validation.ok) {
    return { ok: false, error: { reason: "invalid-merge", validatorReason: validation.reason } };
  }

  // Identifying fields for the push row.
  const identifying = merged.root
    ? {
        url: merged.root.data.url as string,
        title: merged.root.data.title as string,
        favicon: merged.root.data.favicon ? (merged.root.data.favicon as string) : null,
      }
    : { url: null, title: null, favicon: null };

  // 4. Offline short-circuit — queue for later.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await enqueuePendingOp({ kind: "push_tree", treeId: input.treeId, queuedAt: Date.now() });
    return { ok: false, error: { reason: "offline", queued: true } };
  }

  mergeInFlight.add(input.treeId);
  try {
    // 5. Conditional upsert. TOCTOU caught here.
    const pushRes = await pushRowConditional({
      id: input.treeId,
      label: input.mergedLabel.label,
      labelSource: input.mergedLabel.source,
      labelUpdatedAt: input.mergedLabel.updatedAt,
      payload: merged,
      nodeCount: merged.nodeCount,
      rootUrl: identifying.url,
      rootTitle: identifying.title,
      rootFavicon: identifying.favicon,
      expectedServerUpdatedAt: input.expectedServerUpdatedAt,
    });

    if (!pushRes.ok) {
      if (pushRes.reason === "server-changed") {
        // Re-fetch to surface the new preview in the UI.
        const fresh = await fetchRemoteTreeForConflict(input.treeId);
        if (fresh.ok) {
          return { ok: false, error: { reason: "server-changed", latest: fresh.value } };
        }
        return { ok: false, error: { reason: "network" } };
      }
      if (pushRes.reason === "row-deleted") {
        return { ok: false, error: { reason: "row-deleted" } };
      }
      return { ok: false, error: { reason: "network" } };
    }

    // 6. Local write — active vs stored branch.
    try {
      if (activeMeta.id === input.treeId) {
        const nextTree = NavigationTreeMapper.fromJSON(merged);
        await treeStorage.setActiveTree(nextTree, {
          ...activeMeta,
          label: input.mergedLabel.label,
          labelSource: input.mergedLabel.source,
          labelUpdatedAt: input.mergedLabel.updatedAt,
        });
        await treeStorage.flushSaveNow();
      } else {
        await treeStorage.updateStoredTreeWithLabel(
          input.treeId,
          merged,
          input.mergedLabel.label,
          input.mergedLabel.source,
          input.mergedLabel.updatedAt,
          Date.now(),
        );
      }
    } catch (localErr) {
      // Upsert already succeeded; the next pull tick will re-establish
      // local/remote parity. Log and report success to the UI so the
      // banner clears.
      log.warn("applyConflictMergeInternal: local write failed after upsert", {
        treeId: input.treeId,
        error: localErr instanceof Error ? localErr.message : String(localErr),
      });
    }

    // 7. syncMeta from the authoritative upsert response.
    const prevMeta = await getSyncMeta(input.treeId);
    await writeSyncMeta(input.treeId, {
      lastSyncedAt: pushRes.updatedAt,
      lastRemoteUpdatedAt: pushRes.updatedAt,
      lastPushedLocalVersion: prevMeta.lastPushedLocalVersion + 1,
    });

    // 8. Fire resolved event + UI refresh.
    clearPendingConflict(input.treeId);
    fireExtensionEvent(EXTENSION_MESSAGE.SYNC_CONFLICT_RESOLVED, { treeId: input.treeId });
    try {
      const active = await treeStorage.getActiveMeta();
      const others = await treeStorage.getStoredSummaries();
      fireExtensionEvent(EXTENSION_MESSAGE.TREES_UPDATED, { active, others });
    } catch {
      /* non-fatal */
    }

    const value: ApplyOk = {
      mergedUpdatedAt: pushRes.updatedAt,
      diffCounts: {
        unchanged: 0,
        added: 0,
        removed: 0,
        modified: 0,
        moved: 0,
        reordered: 0,
        corrupt: 0,
      },
      mode: input.mode,
    };
    setStatus("saved");
    return { ok: true, value };
  } finally {
    mergeInFlight.delete(input.treeId);
  }
}

/**
 * Fork-then-reset resolution for a sync conflict.
 *
 * Steps:
 *   1. Snapshot the current LOCAL tree (active or stored) as a brand-new
 *      stored tree labelled "<original> (fork)". The user's work never
 *      leaves their device.
 *   2. Fetch the server's authoritative copy of the conflicting tree.
 *   3. Overwrite the original slot (active or stored) with the server
 *      payload; realign syncMeta so subsequent pushes no longer race.
 *   4. Schedule a push of the new fork so it's backed up to the cloud.
 *   5. Fire SYNC_CONFLICT_RESOLVED so the toast dismisses.
 *
 * User model: "keep my work safely somewhere, accept the cloud here".
 */
export async function forkTreeFromConflict(
  treeId: string,
): Promise<{ ok: true; forkedTreeId: string } | { ok: false; reason: string }> {
  const auth = getAuthState();
  if (auth.status !== "signed-in") return { ok: false, reason: "auth" };

  const activeMeta = await treeStorage.getActiveMeta();
  const isActive = activeMeta.id === treeId;

  // 1. Capture local content + label for the fork.
  let localJSON: NavigationTreeJSON;
  let origLabel: string;
  let origCreatedAt: number;
  if (isActive) {
    const tree = await treeStorage.getOrCreateTree();
    if (!tree.getRoot()) return { ok: false, reason: "empty_local" };
    localJSON = NavigationTreeMapper.toJSON(tree);
    origLabel = activeMeta.label;
    origCreatedAt = activeMeta.createdAt;
  } else {
    const record = await treeStorage.getFullStoredRecord(treeId);
    if (!record) return { ok: false, reason: "missing_local" };
    localJSON = record.tree;
    origLabel = record.label;
    origCreatedAt = record.createdAt;
  }

  const now = Date.now();
  const forkedId = uuidv7();
  const forkMeta = {
    id: forkedId,
    label: `${origLabel} (fork)`,
    labelSource: "user" as TreeLabelSource,
    labelUpdatedAt: now,
    createdAt: now,
  };

  // 2. Fetch the server's authoritative copy BEFORE snapshotting — if
  // the server fetch fails we don't want to leave a half-applied fork.
  mergeInFlight.add(treeId);
  try {
    const preview = await fetchRemoteTreeForConflict(treeId);
    if (!preview.ok) return { ok: false, reason: preview.error.reason };

    let serverJSON: NavigationTreeJSON;
    try {
      serverJSON = fromCompact(preview.value.serverPayloadCompact);
    } catch (err) {
      return {
        ok: false,
        reason: `decode: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // 3. Snapshot the local tree as the fork.
    await treeStorage.addStoredTreeFromJSON(forkMeta, localJSON);

    // 4. Overwrite the original slot with the server payload.
    if (isActive) {
      const serverTree = NavigationTreeMapper.fromJSON(serverJSON);
      await treeStorage.setActiveTree(serverTree, {
        id: treeId,
        createdAt: origCreatedAt,
        label: preview.value.serverLabel.label,
        labelSource: preview.value.serverLabel.source,
        labelUpdatedAt: preview.value.serverLabel.updatedAt,
      });
      await treeStorage.flushSaveNow();
    } else {
      await treeStorage.updateStoredTreeWithLabel(
        treeId,
        serverJSON,
        preview.value.serverLabel.label,
        preview.value.serverLabel.source,
        preview.value.serverLabel.updatedAt,
        Date.now(),
      );
    }

    // 5. Align syncMeta with server. No lastPushedLocalVersion bump
    // because we haven't written anything NEW to the server for this
    // tree — we pulled.
    await writeSyncMeta(treeId, {
      lastSyncedAt: preview.value.serverUpdatedAt,
      lastRemoteUpdatedAt: preview.value.serverUpdatedAt,
      lastPushedLocalVersion: 0,
    });
  } finally {
    mergeInFlight.delete(treeId);
  }

  // 6. Push the fork to the cloud. Fire-and-forget — if the push fails
  // it'll be picked up on the next drain.
  void doPushStored(forkedId).catch((err) => {
    log.warn("forkTreeFromConflict: fork push failed; will retry", {
      forkedId,
      error: err instanceof Error ? err.message : String(err),
    });
    void enqueuePendingOp({ kind: "push_tree", treeId: forkedId, queuedAt: Date.now() });
  });

  // 7. Fire events so the UI dismisses the toast + refreshes tree list.
  clearPendingConflict(treeId);
  fireExtensionEvent(EXTENSION_MESSAGE.SYNC_CONFLICT_RESOLVED, { treeId });
  try {
    const active = await treeStorage.getActiveMeta();
    const others = await treeStorage.getStoredSummaries();
    fireExtensionEvent(EXTENSION_MESSAGE.TREES_UPDATED, { active, others });
  } catch {
    /* non-fatal */
  }

  captureEvent("sync_conflict_apply_ok", { treeId, mode: "fork", ms: 0 });
  return { ok: true, forkedTreeId: forkedId };
}

/**
 * Fetch a tree's full payload from Supabase. Used by `loadTree` when a stub
 * entry is opened. Materializes the payload into the local tree blob
 * so subsequent opens are instant.
 */
export async function fetchRemoteTreePayload(treeId: string): Promise<NavigationTreeJSON | null> {
  const supabase = getSupabaseClient();
  const auth = getAuthState();
  if (!supabase || auth.status !== "signed-in") return null;

  const { data, error } = await supabase
    .from("trails")
    .select("payload,updated_at")
    .eq("id", treeId)
    .eq("user_id", auth.identity.userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    captureError(error, { kind: "sync_fetch_payload", treeId });
    return null;
  }
  if (!data?.payload) return null;

  const payload = data.payload as NavigationTreeJSON;
  try {
    await treeStorage.saveStoredTree(treeId, payload);
    // Clear the `stub: true` marker so future opens hit the local
    // blob instead of re-downloading from Supabase every time (#36).
    await treeStorage.unstubTreeEntry(treeId);
    const meta = await getSyncMeta(treeId);
    await writeSyncMeta(treeId, {
      ...meta,
      lastSyncedAt: data.updated_at,
      lastRemoteUpdatedAt: data.updated_at,
    });
  } catch (error) {
    log.warn("materializing remote tree failed (keeping stub)", {
      treeId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return payload;
}

/**
 * On sign-in, enumerate every non-stub local tree that the current
 * device has not yet pushed and enqueue a push for each. The pending
 * queue persists across service-worker restarts, so a partial backfill
 * survives eviction and resumes on the next wake.
 *
 * The active tree is NOT enqueued here — `schedulePush` handles it via
 * the debounced path. Everything else goes through the queue so the
 * rate limiter (20/min) paces the upload.
 */
async function backfillUnsyncedTrees(): Promise<void> {
  const auth = getAuthState();
  if (auth.status !== "signed-in") return;

  const index = await treeStorage.getTreeIndex();
  const syncMap = await syncStateItem.getValue();
  const active = await treeStorage.getActiveMeta();

  let queued = 0;
  for (const entry of index) {
    if (isTreeStub(entry)) continue;
    if (entry.id === active.id) continue;
    if (syncMap[entry.id]?.lastSyncedAt) continue;
    await enqueuePendingOp({
      kind: "push_tree",
      treeId: entry.id,
      queuedAt: Date.now(),
    });
    queued++;
  }

  if (queued === 0) return;
  log.info("backfill: queued pushes for unsynced local trees", { count: queued });
  notifyUi({
    message: `Syncing ${queued} local ${queued === 1 ? "tree" : "trees"} to the cloud…`,
    icon: "Info",
    durationMs: 5000,
  });
  await drainPendingOps();
}

export async function periodicPull(): Promise<void> {
  if (!running) return;
  const auth = getAuthState();
  if (auth.status !== "signed-in") return;
  await drainPendingOps().catch((error) => {
    log.warn("drain failed", { error: error instanceof Error ? error.message : String(error) });
  });
  await doPull().catch((error) => {
    log.warn("pull failed", { error: error instanceof Error ? error.message : String(error) });
  });
}

function startPullTimer(): void {
  // chrome.alarms.create is idempotent on name — safe to call repeatedly.
  chrome.alarms.create(SYNC_PULL_ALARM, {
    periodInMinutes: SYNC_PULL_PERIOD_MINUTES,
  });
}

function stopPullTimer(): void {
  void chrome.alarms.clear(SYNC_PULL_ALARM);
}

/**
 * Called by the top-level chrome.alarms.onAlarm listener in
 * service-worker.ts when the SYNC_PULL_ALARM fires. Exported so the
 * listener module doesn't have to know about auth state — we re-check
 * it here because the SW may have been dormant between alarm fires.
 */
export async function handlePullAlarm(): Promise<void> {
  if (!running) return;
  await periodicPull();
}

/**
 * Start the background sync engine. Idempotent — second call is a no-op.
 * The pull timer only runs while signed-in; sign-out tears it down so the
 * service worker isn't woken once per minute for nothing.
 */
export function startSyncEngine(): void {
  if (running) return;
  running = true;

  subscribeAuthState((state) => {
    if (!running) return;
    if (state.status === "signed-in") {
      startPullTimer();
      void periodicPull();
      schedulePush(); // push local tree if it's ahead of server
      void backfillUnsyncedTrees().catch((error) => {
        log.warn("backfill failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } else {
      stopPullTimer();
      setStatus("idle");
    }
  });

  // Drain on service worker wake. Don't fire it here — wait for the
  // first signed-in transition above, because at cold boot the auth
  // cache is `signed-out` until initAuth() resolves, and a premature
  // drain would see `skipped` from doPushActive/doPushStored and
  // terminal-process the op off the queue (closes P0.5).
}

export function stopSyncEngine(): void {
  running = false;
  stopPullTimer();
}
