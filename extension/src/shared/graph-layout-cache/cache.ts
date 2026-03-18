import type { CachedLayoutResult } from './types.js';

// ---------------------------------------------------------------------------
// chrome.storage.session helpers for layout cache
// ---------------------------------------------------------------------------

const PREFIX = 'graph-layout:';

function storageKey(
  treeId: string,
  layoutMode?: string,
  collapseSignature?: string,
  recencyOrdering?: boolean,
): string {
  // When reading without knowing exact state, use base key for lookup
  if (layoutMode === undefined) return `${PREFIX}${treeId}`;
  // Enriched key for write: includes state that affects layout positions
  const recency = recencyOrdering ? '1' : '0';
  const collapse = collapseSignature || '_';
  return `${PREFIX}${treeId}:${layoutMode}:${collapse}:${recency}`;
}

function getSessionStorage(): typeof chrome.storage.session | null {
  return globalThis.chrome?.storage?.session ?? null;
}

export async function writeLayoutCache(result: CachedLayoutResult): Promise<void> {
  const storage = getSessionStorage();
  if (!storage) return;
  const key = storageKey(result.treeId, result.layoutMode, result.collapseSignature, result.recencyOrdering);
  // Write to both enriched key (exact match) and base key (fallback for consumers
  // that don't know the state yet, e.g. spotlight-graph reads before knowing collapse state)
  await storage.set({
    [key]: result,
    [storageKey(result.treeId)]: result,
  });
}

export async function readLayoutCache(
  treeId: string,
  layoutMode?: string,
  collapseSignature?: string,
  recencyOrdering?: boolean,
): Promise<CachedLayoutResult | null> {
  const storage = getSessionStorage();
  if (!storage) return null;
  // Try enriched key first if state params provided
  if (layoutMode !== undefined) {
    const enrichedKey = storageKey(treeId, layoutMode, collapseSignature, recencyOrdering);
    const enrichedData = await storage.get(enrichedKey);
    const enrichedEntry = enrichedData[enrichedKey] as CachedLayoutResult | undefined;
    if (enrichedEntry) return enrichedEntry;
  }
  // Fall back to base key
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
