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

import { storage } from 'wxt/utils/storage';
import { migrationDoneItem, syncStateItem } from '../../../shared/config/storage-items.js';

const V2_SERVER_AT_KEY = 'local:trail_sync_server_at' as const;
const V2_TOMBSTONES_KEY = 'local:trail_sync_tombstones' as const;

export async function migrateV2ToV3(): Promise<void> {
  const done = await migrationDoneItem.getValue();
  if (done) return;

  try {
    // If v3 sync state already exists, skip migration
    const existing = await syncStateItem.getValue();
    if (existing) {
      await migrationDoneItem.setValue(true);
      return;
    }

    const serverSyncAtRaw = await storage.getItem<string>(V2_SERVER_AT_KEY);
    const serverSyncAt = typeof serverSyncAtRaw === 'string'
      ? serverSyncAtRaw
      : new Date(0).toISOString();

    // Extract pending deletes from v2 tombstones
    const tombstonesRaw = await storage.getItem<Array<{ id?: string }>>(V2_TOMBSTONES_KEY);
    const tombstones = Array.isArray(tombstonesRaw) ? tombstonesRaw : [];
    const pendingDeletes = tombstones
      .map((t) => (typeof t?.id === 'string' ? t.id : ''))
      .filter(Boolean);

    // Write v3 sync state
    await syncStateItem.setValue({
      serverSyncAt,
      dirtyIds: [],
      pendingDeletes,
    });
    await migrationDoneItem.setValue(true);

    // Clean up v2 keys
    await storage.removeItem(V2_SERVER_AT_KEY);
    await storage.removeItem(V2_TOMBSTONES_KEY);

    // Sync migration v2→v3 completed.
  } catch (error) {
    console.error('Sync migration v2→v3 failed:', error);
    // Mark done anyway to prevent repeated failures
    await migrationDoneItem.setValue(true).catch(() => {});
  }
}
