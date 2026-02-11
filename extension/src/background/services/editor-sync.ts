import { buildBackendUrl, initBackendConfig, BACKEND_CONFIG } from '../../shared/config/backend.js';
import { NavigationTreeMapper } from '../../shared/lib/mapper.js';
import { treeStorage } from './tree-storage.js';
import { setCachedTree } from './tree-cache.js';
import { sendRuntimeMessage } from '../messaging/send-message.js';
import { msg, type SyncStatus } from '../../shared/types/messages.js';
import { findBestTrailFavicon } from '../../shared/lib/tree-favicon.js';

/* ------------------------------------------------------------------ */
/*  Editor Sync Service                                                */
/*                                                                     */
/*  Handles debounced PATCH syncing of the editor tree to the API.     */
/*  After each tree mutation in editor mode, the service waits 3s      */
/*  then PATCHes the full tree payload.                                */
/* ------------------------------------------------------------------ */

const AUTH_STORAGE_KEY = 'trail_auth_session' as const;
const SYNC_DEBOUNCE_MS = 3000;
const RETRY_BACKOFFS = [2000, 4000, 8000] as const;

type SyncState = {
  treeId: string | null;
  dirty: boolean;
  status: SyncStatus;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: Promise<void> | null;
  retryCount: number;
};

const state: SyncState = {
  treeId: null,
  dirty: false,
  status: 'idle',
  timer: null,
  inFlight: null,
  retryCount: 0,
};

/* ------------------------------------------------------------------ */
/*  Status broadcasting                                                */
/* ------------------------------------------------------------------ */

function broadcastStatus(status: SyncStatus): void {
  state.status = status;
  sendRuntimeMessage(msg.syncStatusUpdated({ status }));
}

/* ------------------------------------------------------------------ */
/*  Auth helper                                                        */
/* ------------------------------------------------------------------ */

async function getAccessToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  const raw = result[AUTH_STORAGE_KEY] as { accessToken?: string } | undefined;
  if (!raw || typeof raw !== 'object') return null;
  return typeof raw.accessToken === 'string' && raw.accessToken ? raw.accessToken : null;
}

/* ------------------------------------------------------------------ */
/*  Core sync logic                                                    */
/* ------------------------------------------------------------------ */

async function patchTree(treeId: string): Promise<boolean> {
  await initBackendConfig();
  const token = await getAccessToken();
  if (!token) return false;

  const tree = await treeStorage.getOrCreateTree();
  const json = NavigationTreeMapper.toJSON(tree);
  const root = tree.getRoot();
  const savedAt = Date.now();
  const savedAtIso = new Date(savedAt).toISOString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_CONFIG.timeoutMs);

  try {
    const response = await fetch(buildBackendUrl(`/trails/${treeId}`), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        payload: json,
        nodeCount: tree.size(),
        rootUrl: root?.data.url ?? null,
        rootTitle: root?.data.title ?? null,
        rootFavicon: findBestTrailFavicon(json) ?? root?.data.favicon ?? null,
        savedAt: savedAtIso,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`EditorSync: PATCH /trails/${treeId} failed with ${response.status}`);
      return false;
    }

    // Update the LRU cache with the freshly synced data
    await setCachedTree(treeId, json, savedAt);

    // Update archives if we're editing a non-active tree
    if (treeStorage.isEditingNonActiveTree) {
      await treeStorage.updateArchivedTree(treeId, tree, savedAt);
    }

    return true;
  } catch (error) {
    console.warn('EditorSync: network error during PATCH', error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function performSync(): Promise<void> {
  const { treeId } = state;
  if (!treeId) return;

  broadcastStatus('saving');

  const ok = await patchTree(treeId);
  if (ok) {
    state.dirty = false;
    state.retryCount = 0;
    broadcastStatus('saved');
    return;
  }

  // Retry with backoff
  if (state.retryCount < RETRY_BACKOFFS.length) {
    const delay = RETRY_BACKOFFS[state.retryCount]!;
    state.retryCount += 1;
    broadcastStatus('saving');
    scheduleSync(delay);
    return;
  }

  // All retries exhausted
  broadcastStatus('error');
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

    if (state.inFlight) return; // Already syncing
    state.inFlight = performSync().finally(() => {
      state.inFlight = null;
    });
  }, delayMs);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Call when entering editor mode to start tracking changes.
 */
export function editorSyncStart(treeId: string): void {
  clearTimer();
  state.treeId = treeId;
  state.dirty = false;
  state.status = 'idle';
  state.retryCount = 0;
  state.inFlight = null;
}

/**
 * Mark the editor tree as dirty and schedule a debounced sync.
 */
export function editorSyncMarkDirty(): void {
  if (!state.treeId) return;
  state.dirty = true;
  state.retryCount = 0;
  scheduleSync();
}

/**
 * Force an immediate sync if dirty. Returns when complete.
 * Used on editor exit to ensure no data loss.
 */
export async function editorSyncFlush(): Promise<void> {
  clearTimer();
  if (!state.treeId || !state.dirty) return;

  // Wait for any in-flight sync to finish first
  if (state.inFlight) {
    await state.inFlight;
  }

  // If still dirty after in-flight finished, sync now
  if (state.dirty && state.treeId) {
    await performSync();
  }
}

/**
 * Stop tracking editor sync state.
 */
export function editorSyncStop(): void {
  clearTimer();
  state.treeId = null;
  state.dirty = false;
  state.status = 'idle';
  state.retryCount = 0;
  state.inFlight = null;
}

/**
 * Retry a failed sync manually.
 */
export function editorSyncRetry(): void {
  if (!state.treeId || state.status !== 'error') return;
  state.retryCount = 0;
  state.dirty = true;
  scheduleSync(0);
}

/**
 * Get the current sync status.
 */
export function getEditorSyncStatus(): SyncStatus {
  return state.status;
}
