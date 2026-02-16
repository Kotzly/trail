/**
 * Persistent dirty set + pending deletes tracker.
 * Backed by `trail_v3_sync` in chrome.storage.local.
 *
 * Tracks which trees have local changes that need to be pushed,
 * and which trees need to be deleted on the server.
 */

const SYNC_STATE_KEY = 'trail_v3_sync' as const;

type SyncState = {
  serverSyncAt: string | null;
  dirtyIds: string[];
  pendingDeletes: string[];
};

const DEFAULT_STATE: SyncState = {
  serverSyncAt: null,
  dirtyIds: [],
  pendingDeletes: [],
};

let cached: SyncState | null = null;

async function load(): Promise<SyncState> {
  if (cached) return cached;
  const result = await chrome.storage.local.get(SYNC_STATE_KEY);
  const raw = result[SYNC_STATE_KEY];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const state = raw as Partial<SyncState>;
    cached = {
      serverSyncAt: typeof state.serverSyncAt === 'string' ? state.serverSyncAt : null,
      dirtyIds: Array.isArray(state.dirtyIds) ? state.dirtyIds.filter((id) => typeof id === 'string') : [],
      pendingDeletes: Array.isArray(state.pendingDeletes) ? state.pendingDeletes.filter((id) => typeof id === 'string') : [],
    };
    return cached;
  }
  cached = { ...DEFAULT_STATE };
  return cached;
}

async function persist(): Promise<void> {
  if (!cached) return;
  await chrome.storage.local.set({ [SYNC_STATE_KEY]: cached });
}

export const dirtyTracker = {
  async markDirty(id: string): Promise<void> {
    const state = await load();
    if (!state.dirtyIds.includes(id)) {
      state.dirtyIds.push(id);
      await persist();
    }
  },

  async markClean(id: string): Promise<void> {
    const state = await load();
    const idx = state.dirtyIds.indexOf(id);
    if (idx >= 0) {
      state.dirtyIds.splice(idx, 1);
      await persist();
    }
  },

  async queueDelete(id: string): Promise<void> {
    const state = await load();
    // Remove from dirty (no point pushing then deleting)
    const dirtyIdx = state.dirtyIds.indexOf(id);
    if (dirtyIdx >= 0) state.dirtyIds.splice(dirtyIdx, 1);
    // Add to pending deletes
    if (!state.pendingDeletes.includes(id)) {
      state.pendingDeletes.push(id);
    }
    await persist();
  },

  async clearDelete(id: string): Promise<void> {
    const state = await load();
    const idx = state.pendingDeletes.indexOf(id);
    if (idx >= 0) {
      state.pendingDeletes.splice(idx, 1);
      await persist();
    }
  },

  async getDirtyIds(): Promise<string[]> {
    const state = await load();
    return [...state.dirtyIds];
  },

  async getPendingDeletes(): Promise<string[]> {
    const state = await load();
    return [...state.pendingDeletes];
  },

  async getServerSyncAt(): Promise<string> {
    const state = await load();
    return state.serverSyncAt ?? new Date(0).toISOString();
  },

  async setServerSyncAt(value: string): Promise<void> {
    const state = await load();
    state.serverSyncAt = value;
    await persist();
  },

  async reset(): Promise<void> {
    cached = { ...DEFAULT_STATE };
    await persist();
  },

  /** Clear everything including serverSyncAt. Used on account switch. */
  async clearAll(): Promise<void> {
    cached = { ...DEFAULT_STATE };
    await chrome.storage.local.remove(SYNC_STATE_KEY).catch(() => undefined);
  },
};
