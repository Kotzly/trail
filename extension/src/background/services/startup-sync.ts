/**
 * Startup sync service - ensures tree index is up-to-date when extension loads
 * and before user opens the dropdown.
 */

import { cloudSync } from './cloud-sync.js';

const LAST_SYNC_KEY = 'trail_startup_sync_last';
const DEBOUNCE_MS = 30_000; // 30 seconds

let lastSyncTime = 0;

/**
 * Ensure the tree index is synced with the cloud.
 * Uses debounce to prevent excessive syncs.
 * Should be called on extension startup and before dropdown opens.
 */
export async function ensureIndexSynced(): Promise<void> {
  const now = Date.now();
  if (now - lastSyncTime < DEBOUNCE_MS) {
    return;
  }

  lastSyncTime = now;

  try {
    await cloudSync.syncNow('scheduled');
  } catch (error) {
    console.warn('Startup sync failed:', error);
  }
}

/**
 * Reset the debounce timer - useful for testing.
 */
export function resetStartupSyncDebounce(): void {
  lastSyncTime = 0;
}
