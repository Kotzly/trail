import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import { treeStorage } from "./tree-storage.js";
import { syncApi, SyncApiError } from "./sync/api.js";
import { dirtyTracker } from "./sync/dirty-tracker.js";
import { sendRuntimeMessage } from "../messaging/send-message.js";
import { rpc, type SyncStatus } from "@shared/rpc/contracts.js";
import { findBestTrailFavicon } from "@shared/lib/tree-favicon.js";

/* ------------------------------------------------------------------ */
/*  Editor Sync Service                                                */
/*                                                                     */
/*  Handles debounced PATCH syncing of the editor tree to the API.     */
/*  After each tree mutation in editor mode, the service waits 3s      */
/*  then PATCHes the full tree payload.                                */
/*                                                                     */
/*  Also marks trees as dirty for the sync engine to push via PUT.     */
/* ------------------------------------------------------------------ */

const SYNC_DEBOUNCE_MS = 3000;
const RETRY_BACKOFFS = [2000, 4000, 8000] as const;

export type EditorSyncFlushResult = { ok: true } | { ok: false; error: string };

type SyncState = {
  treeId: string | null;
  dirty: boolean;
  status: SyncStatus;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: Promise<EditorSyncFlushResult> | null;
  retryCount: number;
};

const state: SyncState = {
  treeId: null,
  dirty: false,
  status: "idle",
  timer: null,
  inFlight: null,
  retryCount: 0,
};

/* ------------------------------------------------------------------ */
/*  Status broadcasting                                                */
/* ------------------------------------------------------------------ */

function broadcastStatus(status: SyncStatus): void {
  state.status = status;
  sendRuntimeMessage(rpc.syncStatusUpdated({ status }));
}

/* ------------------------------------------------------------------ */
/*  Core sync logic                                                    */
/* ------------------------------------------------------------------ */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function patchTree(treeId: string): Promise<EditorSyncFlushResult> {
  const tree = await treeStorage.getOrCreateTree();
  const json = NavigationTreeMapper.toJSON(tree);
  const root = tree.getRoot();
  const savedAt = Date.now();
  const savedAtIso = new Date(savedAt).toISOString();

  try {
    await syncApi.patchTree(treeId, {
      payload: json,
      nodeCount: tree.size(),
      rootUrl: root?.data.url ?? null,
      rootTitle: root?.data.title ?? null,
      rootFavicon: findBestTrailFavicon(json) ?? root?.data.favicon ?? null,
      savedAt: savedAtIso,
    });

    // Update archives if we're editing a non-active tree
    if (treeStorage.isEditingNonActiveTree) {
      await treeStorage.updateArchivedTree(treeId, tree, savedAt);
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof SyncApiError) {
      console.warn(`EditorSync: PATCH /trails/${treeId} failed: ${error.message}`);
      return { ok: false, error: error.message };
    }
    console.warn("EditorSync: network error during PATCH", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error during PATCH",
    };
  }
}

async function performSync(): Promise<EditorSyncFlushResult> {
  const { treeId } = state;
  if (!treeId) {
    return { ok: false, error: "Editor sync is not active" };
  }

  broadcastStatus("saving");

  const result = await patchTree(treeId);
  if (result.ok) {
    state.dirty = false;
    state.retryCount = 0;
    broadcastStatus("saved");
    return result;
  }

  // Retry with backoff
  if (state.retryCount < RETRY_BACKOFFS.length) {
    const delay = RETRY_BACKOFFS[state.retryCount]!;
    state.retryCount += 1;
    broadcastStatus("saving");
    scheduleSync(delay);
    return result;
  }

  // All retries exhausted
  broadcastStatus("error");
  return result;
}

async function flushSyncWithRetries(treeId: string): Promise<EditorSyncFlushResult> {
  broadcastStatus("saving");
  let lastError = "Editor sync failed";

  for (let attempt = 0; attempt <= RETRY_BACKOFFS.length; attempt += 1) {
    const result = await patchTree(treeId);
    if (result.ok) {
      state.dirty = false;
      state.retryCount = 0;
      broadcastStatus("saved");
      return result;
    }

    lastError = result.error;
    if (attempt < RETRY_BACKOFFS.length) {
      await sleep(RETRY_BACKOFFS[attempt]!);
    }
  }

  state.retryCount = RETRY_BACKOFFS.length;
  broadcastStatus("error");
  return { ok: false, error: lastError };
}

/* ------------------------------------------------------------------ */
/*  Scheduling                                                         */
/* ------------------------------------------------------------------ */

function clearTimer(): void {
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
}

function scheduleSync(delayMs: number = SYNC_DEBOUNCE_MS): void {
  clearTimer();
  state.timer = setTimeout(() => {
    state.timer = null;
    if (!state.dirty && state.retryCount === 0) return;

    if (state.inFlight) return;
    state.inFlight = performSync().finally(() => {
      state.inFlight = null;
    });
  }, delayMs);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function editorSyncStart(treeId: string): void {
  clearTimer();
  state.treeId = treeId;
  state.dirty = false;
  state.status = "idle";
  state.retryCount = 0;
  state.inFlight = null;
}

/**
 * Mark the editor tree as dirty and schedule a debounced sync.
 * Also marks the tree dirty for the sync engine (so the next full
 * sync cycle pushes the complete record via PUT).
 */
export function editorSyncMarkDirty(): void {
  if (!state.treeId) return;
  state.dirty = true;
  state.retryCount = 0;
  scheduleSync();

  // Mark dirty for the sync engine too
  void dirtyTracker.markDirty(state.treeId);
}

export async function editorSyncFlush(): Promise<EditorSyncFlushResult> {
  clearTimer();
  if (!state.treeId || !state.dirty) {
    return { ok: true };
  }

  if (state.inFlight) {
    await state.inFlight;
  }

  clearTimer();

  if (!state.treeId || !state.dirty) {
    return { ok: true };
  }

  return flushSyncWithRetries(state.treeId);
}

export function editorSyncStop(): void {
  clearTimer();
  state.treeId = null;
  state.dirty = false;
  state.status = "idle";
  state.retryCount = 0;
  state.inFlight = null;
}

export function editorSyncRetry(): void {
  if (!state.treeId || state.status !== "error") return;
  state.retryCount = 0;
  state.dirty = true;
  scheduleSync(0);
}

export function getEditorSyncStatus(): SyncStatus {
  return state.status;
}
