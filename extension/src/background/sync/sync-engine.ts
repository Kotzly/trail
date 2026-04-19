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
  pendingSyncOpsItem,
  syncStateItem,
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

const log = createLogger("sync");

const PUSH_DEBOUNCE_MS = 2_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const PULL_INTERVAL_MS = 60_000;

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
        // Terminal outcomes (ok/skipped/conflict) — remove from queue.
        // Retry-able outcomes (rate_limited/offline/error) — leave the
        // remainder in the queue for the next drain.
        if (outcome === "ok" || outcome === "skipped" || outcome === "conflict") {
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
      log.info("push: conflict detected (newer server from another device)", {
        treeId: input.id,
      });
      fireExtensionEvent(EXTENSION_MESSAGE.SYNC_CONFLICT, {
        treeId: input.id,
        serverUpdatedAt: existing.updated_at,
        serverDeviceId: existing.device_id,
      });
      notifyUi({
        message: `"${input.label}" has newer edits on another device — resolve the conflict to sync.`,
        icon: "AlertTriangle",
        durationMs: 10000,
      });
      captureEvent("sync_failed", { reason: "conflict" });
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

/** Push the in-memory active tree. */
async function doPushActive(): Promise<PushOutcome> {
  const auth = getAuthState();
  if (auth.status !== "signed-in") return "skipped";

  const meta = await treeStorage.getActiveMeta();
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

  const all = await syncStateItem.getValue();
  const { [treeId]: _removed, ...rest } = all;
  await syncStateItem.setValue(rest);
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
  void doDelete(treeId).catch((error) => {
    log.error("delete failed", {
      error: error instanceof Error ? error.message : String(error),
    });
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
 * Merge remote trails into the local tree index as stubs. A stub is a
 * summary-only entry — payload is fetched on demand via `loadTree` (see
 * tree-loader.ts). Local entries with full payload win over stubs.
 */
async function doPull(): Promise<void> {
  const supabase = getSupabaseClient();
  const auth = getAuthState();
  if (!supabase || auth.status !== "signed-in") return;

  const { data, error } = await supabase
    .from("trails")
    .select(
      "id,device_id,label,label_source,label_updated_at,created_at,updated_at,saved_at,node_count,root_url,root_title,root_favicon,deleted_at",
    )
    .eq("user_id", auth.identity.userId)
    .is("deleted_at", null);

  if (error) {
    // Swallow offline errors; periodic pull retries and the user isn't
    // blocked by them the way they are on push.
    if (!isOfflineError(error)) {
      captureError(error, { kind: "sync_pull" });
    }
    return;
  }

  const rows = (data ?? []) as TrailRow[];
  if (rows.length === 0) return;

  const activeMeta = await treeStorage.getActiveMeta();
  const currentIndex = await treeStorage.getTreeIndex();
  const byId = new Map(currentIndex.map((e) => [e.id, e] as const));
  let changed = false;

  for (const row of rows) {
    if (row.id === activeMeta.id) continue; // active tree handled by push path
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
      fireExtensionEvent(EXTENSION_MESSAGE.SYNC_CONFLICT, {
        treeId: row.id,
        serverUpdatedAt: row.updated_at,
        serverDeviceId: row.device_id,
      });
    }
  }

  if (changed) {
    const next: TreeIndexEntry[] = Array.from(byId.values());
    await treeStorage.setTreeIndex(next);
    // Nudge the UI to refresh the tree switcher.
    try {
      const active = await treeStorage.getActiveMeta();
      const others = await treeStorage.getStoredSummaries();
      fireExtensionEvent(EXTENSION_MESSAGE.TREES_UPDATED, { active, others });
    } catch {
      /* non-fatal */
    }
  }
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

async function periodicPull(): Promise<void> {
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
  if (pullTimer) return;
  pullTimer = setInterval(() => {
    void periodicPull();
  }, PULL_INTERVAL_MS);
}

function stopPullTimer(): void {
  if (!pullTimer) return;
  clearInterval(pullTimer);
  pullTimer = null;
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

  // Drain on service worker wake (no-ops when signed-out; doPush/doDelete
  // re-check auth before touching the network).
  void drainPendingOps().catch(() => {});
}

export function stopSyncEngine(): void {
  running = false;
  stopPullTimer();
}
