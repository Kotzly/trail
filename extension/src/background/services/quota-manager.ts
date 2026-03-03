/**
 * Quota-aware wrapper for chrome.storage.local writes.
 *
 * When a QUOTA_BYTES error is caught, the oldest non-stub archive is evicted
 * (replaced with a TreeStub) and the write is retried.
 */

import { storage } from 'wxt/utils/storage';
import type { TreeSummary, ArchiveIndexEntry, TreeStub } from '../../shared/types/tree.js';
import { isTreeStub } from '../../shared/types/tree.js';
import { archiveIndexItem, archiveBlobKey } from '../../shared/config/storage-items.js';

function isQuotaError(error: unknown): boolean {
  const msg = String(error);
  return msg.includes('QUOTA_BYTES') || msg.includes('quota');
}

/**
 * Write key/value pairs to local storage, automatically evicting the oldest
 * non-stub archive to free space if a quota error is encountered.
 *
 * Accepts an array of entries where each entry is either:
 *   - `{ key, value }` for raw prefixed keys (dynamic archive blobs), or
 *   - `{ item, value }` for WXT storage items.
 */
export type BulkEntry =
  | { key: `local:${string}`; value: unknown }
  | { item: { key: string; setValue: (v: unknown) => Promise<void> }; value: unknown };

export async function quotaAwareSet(
  entries: BulkEntry[],
  options?: { maxRetries?: number },
): Promise<void> {
  const maxRetries = options?.maxRetries ?? 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await writeBulk(entries);
      return;
    } catch (error) {
      if (!isQuotaError(error) || attempt === maxRetries) throw error;
      console.warn(`quotaAwareSet: quota error on attempt ${attempt + 1}, evicting oldest archive`);
      const evicted = await evictOldestArchive();
      if (!evicted) throw error; // nothing left to evict
    }
  }
}

async function writeBulk(entries: BulkEntry[]): Promise<void> {
  for (const entry of entries) {
    if ('item' in entry) {
      await entry.item.setValue(entry.value);
    } else {
      await storage.setItem(entry.key, entry.value);
    }
  }
}

/**
 * Evict the oldest non-stub archive: replace it with a TreeStub and
 * delete its compressed blob from storage.
 *
 * Returns true if an archive was evicted, false if nothing to evict.
 */
export async function evictOldestArchive(): Promise<boolean> {
  const index = await archiveIndexItem.getValue();
  if (index.length === 0) return false;

  // Find the oldest entry that is NOT already a stub
  let oldestIdx = -1;
  let oldestSavedAt = Infinity;
  for (let i = 0; i < index.length; i++) {
    const entry = index[i]!;
    if (isTreeStub(entry)) continue;
    if (entry.savedAt < oldestSavedAt) {
      oldestSavedAt = entry.savedAt;
      oldestIdx = i;
    }
  }

  if (oldestIdx < 0) return false;

  const target = index[oldestIdx]! as TreeSummary;
  console.warn(`quotaManager: evicting archive "${target.label}" (${target.id}), savedAt=${new Date(target.savedAt).toISOString()}`);

  // Replace with stub in the index
  const stub: TreeStub = { ...target, stub: true };
  const nextIndex = [...index];
  nextIndex[oldestIdx] = stub;

  // Write updated index and remove the blob
  await archiveIndexItem.setValue(nextIndex);
  await storage.removeItem(archiveBlobKey(target.id));

  return true;
}
