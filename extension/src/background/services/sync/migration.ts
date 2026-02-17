/**
 * One-time migration from v2 sync state to v3.
 *
 * v2 keys:
 *   trail_sync_server_at   — ISO string of last sync timestamp
 *   trail_sync_tombstones  — array of tombstone records (no longer used in v3)
 *
 * v3 key:
 *   trail_v3_sync — { serverSyncAt, dirtyIds, pendingDeletes }
 *
 * Tree data keys (trail_tree, trail_tree_meta, trail_tree_archives, trail_ar_*)
 * remain unchanged — no data migration is needed for them.
 */

const V2_SERVER_AT_KEY = 'trail_sync_server_at' as const;
const V2_TOMBSTONES_KEY = 'trail_sync_tombstones' as const;
const V3_SYNC_KEY = 'trail_v3_sync' as const;
const MIGRATION_DONE_KEY = 'trail_v3_migration_done' as const;

export async function migrateV2ToV3(): Promise<void> {
  const result = await chrome.storage.local.get(MIGRATION_DONE_KEY);
  if (result[MIGRATION_DONE_KEY] === true) return;

  try {
    const data = await chrome.storage.local.get([V2_SERVER_AT_KEY, V2_TOMBSTONES_KEY, V3_SYNC_KEY]);

    // If v3 sync state already exists, skip migration
    if (data[V3_SYNC_KEY]) {
      await chrome.storage.local.set({ [MIGRATION_DONE_KEY]: true });
      return;
    }

    const serverSyncAt = typeof data[V2_SERVER_AT_KEY] === 'string'
      ? data[V2_SERVER_AT_KEY] as string
      : new Date(0).toISOString();

    // Extract pending deletes from v2 tombstones
    const tombstones = Array.isArray(data[V2_TOMBSTONES_KEY]) ? data[V2_TOMBSTONES_KEY] as Array<{ id?: string }> : [];
    const pendingDeletes = tombstones
      .map((t) => (typeof t?.id === 'string' ? t.id : ''))
      .filter(Boolean);

    // Write v3 sync state
    await chrome.storage.local.set({
      [V3_SYNC_KEY]: {
        serverSyncAt,
        dirtyIds: [],
        pendingDeletes,
      },
      [MIGRATION_DONE_KEY]: true,
    });

    // Clean up v2 keys
    await chrome.storage.local.remove([V2_SERVER_AT_KEY, V2_TOMBSTONES_KEY]);

    // Sync migration v2→v3 completed.
  } catch (error) {
    console.error('Sync migration v2→v3 failed:', error);
    // Mark done anyway to prevent repeated failures
    await chrome.storage.local.set({ [MIGRATION_DONE_KEY]: true }).catch(() => {});
  }
}
