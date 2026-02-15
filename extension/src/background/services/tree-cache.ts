import type { NavigationTreeJSON } from '../../shared/types/tree.js';

/* ------------------------------------------------------------------ */
/*  LRU Tree Cache                                                     */
/*                                                                     */
/*  Stores the N most recently accessed trees in chrome.storage.local  */
/*  so that editor mode can load them instantly without API calls.      */
/* ------------------------------------------------------------------ */

const CACHE_INDEX_KEY = 'trail_tree_cache_index' as const;
const CACHE_PREFIX = 'trail_cache_' as const;
const DEFAULT_MAX_ENTRIES = 10;

export type CachedTree = {
  tree: NavigationTreeJSON;
  version: number;
  cachedAt: number;
};

type CacheIndexEntry = {
  treeId: string;
  cachedAt: number;
};

const storage = chrome.storage.local;

/* ------------------------------------------------------------------ */
/*  Index helpers                                                       */
/* ------------------------------------------------------------------ */

async function readIndex(): Promise<CacheIndexEntry[]> {
  const result = await storage.get(CACHE_INDEX_KEY);
  const raw = result[CACHE_INDEX_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is CacheIndexEntry =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as CacheIndexEntry).treeId === 'string' &&
      typeof (entry as CacheIndexEntry).cachedAt === 'number',
  );
}

async function writeIndex(index: CacheIndexEntry[]): Promise<void> {
  await storage.set({ [CACHE_INDEX_KEY]: index });
}

function cacheKey(treeId: string): string {
  return `${CACHE_PREFIX}${treeId}`;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Get a tree from the LRU cache.
 * Returns null if not found.
 */
export async function getCachedTree(treeId: string): Promise<CachedTree | null> {
  const key = cacheKey(treeId);
  const result = await storage.get(key);
  const raw = result[key] as CachedTree | undefined;
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.tree || typeof raw.version !== 'number' || typeof raw.cachedAt !== 'number') {
    return null;
  }
  // Touch: update access time in index
  const index = await readIndex();
  const now = Date.now();
  const next = [
    { treeId, cachedAt: now },
    ...index.filter((entry) => entry.treeId !== treeId),
  ];
  await writeIndex(next);
  // Also update the cachedAt on the entry itself
  raw.cachedAt = now;
  await storage.set({ [key]: raw });
  return raw;
}

/**
 * Store a tree in the LRU cache, evicting the oldest entry if over capacity.
 */
export async function setCachedTree(
  treeId: string,
  tree: NavigationTreeJSON,
  version: number,
): Promise<void> {
  const now = Date.now();
  const entry: CachedTree = { tree, version, cachedAt: now };
  const key = cacheKey(treeId);

  const index = await readIndex();
  const filtered = index.filter((e) => e.treeId !== treeId);
  const next: CacheIndexEntry[] = [{ treeId, cachedAt: now }, ...filtered];

  // Evict oldest if over capacity
  const evicted: string[] = [];
  while (next.length > DEFAULT_MAX_ENTRIES) {
    const removed = next.pop();
    if (removed) evicted.push(cacheKey(removed.treeId));
  }

  await storage.set({ [key]: entry, [CACHE_INDEX_KEY]: next });
  if (evicted.length > 0) {
    await storage.remove(evicted);
  }
}

/**
 * Remove a specific tree from the cache.
 */
export async function removeCachedTree(treeId: string): Promise<void> {
  const key = cacheKey(treeId);
  const index = await readIndex();
  const next = index.filter((e) => e.treeId !== treeId);
  await writeIndex(next);
  await storage.remove(key);
}

/**
 * Clear the entire tree cache.
 */
export async function clearTreeCache(): Promise<void> {
  const index = await readIndex();
  const keys = index.map((e) => cacheKey(e.treeId));
  keys.push(CACHE_INDEX_KEY);
  await storage.remove(keys);
}
