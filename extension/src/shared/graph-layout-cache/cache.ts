import type { CachedLayoutResult } from './types.js';

// ---------------------------------------------------------------------------
// chrome.storage.session helpers for layout cache
// ---------------------------------------------------------------------------

const PREFIX = 'graph-layout:';

function storageKey(treeId: string): string {
  return `${PREFIX}${treeId}`;
}

function getSessionStorage(): typeof chrome.storage.session | null {
  return globalThis.chrome?.storage?.session ?? null;
}

export async function writeLayoutCache(result: CachedLayoutResult): Promise<void> {
  const storage = getSessionStorage();
  if (!storage) return;
  await storage.set({ [storageKey(result.treeId)]: result });
}

export async function readLayoutCache(treeId: string): Promise<CachedLayoutResult | null> {
  const storage = getSessionStorage();
  if (!storage) return null;
  const key = storageKey(treeId);
  const data = await storage.get(key);
  const entry = data[key] as CachedLayoutResult | undefined;
  return entry ?? null;
}

export async function invalidateLayoutCache(treeId: string): Promise<void> {
  const storage = getSessionStorage();
  if (!storage) return;
  await storage.remove(storageKey(treeId));
}
