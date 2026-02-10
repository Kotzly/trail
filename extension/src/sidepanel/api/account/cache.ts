import type { AccountSnapshot } from '../../../shared/types/account.js';

const SNAPSHOT_CACHE_KEY = 'trail_account_snapshot';

function canPersist(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

export async function loadCachedSnapshot(): Promise<AccountSnapshot | null> {
  if (!canPersist()) return null;
  try {
    const result = await chrome.storage.local.get(SNAPSHOT_CACHE_KEY);
    const stored = result[SNAPSHOT_CACHE_KEY] as AccountSnapshot | undefined;
    return stored ?? null;
  } catch {
    return null;
  }
}

export async function saveCachedSnapshot(snapshot: AccountSnapshot): Promise<void> {
  if (!canPersist()) return;
  try {
    await chrome.storage.local.set({ [SNAPSHOT_CACHE_KEY]: snapshot });
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
