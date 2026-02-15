/**
 * Quota-aware wrapper for chrome.storage.local.set().
 *
 * When a QUOTA_BYTES error is caught, the oldest non-stub archive is evicted
 * (replaced with a TreeStub) and the write is retried.
 */

import type { TreeSummary, ArchiveIndexEntry, TreeStub } from '../../shared/types/tree.js';
import { isTreeStub } from '../../shared/types/tree.js';

const TREE_ARCHIVES_KEY = 'trail_tree_archives' as const;
const ARCHIVE_BLOB_PREFIX = 'trail_ar_' as const;

function archiveBlobKey(treeId: string): string {
  return `${ARCHIVE_BLOB_PREFIX}${treeId}`;
}

function isQuotaError(error: unknown): boolean {
  const msg = String(error);
  return msg.includes('QUOTA_BYTES') || msg.includes('quota');
}

/**
 * Write data to chrome.storage.local, automatically evicting the oldest
 * non-stub archive to free space if a quota error is encountered.
 */
export async function quotaAwareSet(
  data: Record<string, unknown>,
  options?: { maxRetries?: number },
): Promise<void> {
  const maxRetries = options?.maxRetries ?? 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await chrome.storage.local.set(data);
      return;
    } catch (error) {
      if (!isQuotaError(error) || attempt === maxRetries) throw error;
      console.warn(`quotaAwareSet: quota error on attempt ${attempt + 1}, evicting oldest archive`);
      const evicted = await evictOldestArchive();
      if (!evicted) throw error; // nothing left to evict
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
  const result = await chrome.storage.local.get(TREE_ARCHIVES_KEY);
  const raw = result[TREE_ARCHIVES_KEY];
  if (!Array.isArray(raw) || raw.length === 0) return false;

  const index = raw as ArchiveIndexEntry[];

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
  await chrome.storage.local.set({ [TREE_ARCHIVES_KEY]: nextIndex });
  await chrome.storage.local.remove(archiveBlobKey(target.id));

  return true;
}
