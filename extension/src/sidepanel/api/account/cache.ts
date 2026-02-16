import type { AccountSnapshot } from '../../../shared/types/account.js';

const SNAPSHOT_CACHE_KEY = 'trail_account_snapshot';

export type CachedSnapshotEnvelope = {
  snapshot: AccountSnapshot;
  fetchedAt: number;
};

function canPersist(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

export async function loadCachedSnapshotWithAge(): Promise<CachedSnapshotEnvelope | null> {
  if (!canPersist()) return null;
  try {
    const result = await chrome.storage.local.get(SNAPSHOT_CACHE_KEY);
    const stored = result[SNAPSHOT_CACHE_KEY] as CachedSnapshotEnvelope | undefined;
    if (!stored || !stored.snapshot || typeof stored.fetchedAt !== 'number') {
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

export async function loadCachedSnapshot(): Promise<AccountSnapshot | null> {
  const envelope = await loadCachedSnapshotWithAge();
  return envelope?.snapshot ?? null;
}

export async function saveCachedSnapshot(snapshot: AccountSnapshot): Promise<void> {
  if (!canPersist()) return;
  try {
    const envelope: CachedSnapshotEnvelope = { snapshot, fetchedAt: Date.now() };
    await chrome.storage.local.set({ [SNAPSHOT_CACHE_KEY]: envelope });
  } catch {
    // silently ignore persistence errors
  }
}

export async function clearCachedSnapshot(): Promise<void> {
  if (!canPersist()) return;
  try {
    await chrome.storage.local.remove(SNAPSHOT_CACHE_KEY);
  } catch {
    // silently ignore
  }
}
