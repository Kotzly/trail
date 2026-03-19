import type { CachedLayoutResult } from './types.js';

// ---------------------------------------------------------------------------
// chrome.storage.session helpers for layout cache
// ---------------------------------------------------------------------------

const PREFIX = 'graph-layout:';

function storageKey(treeId: string, layoutSignature?: string): string {
  // Without signature: base key (for consumers that don't know state yet)
  if (layoutSignature === undefined) return `${PREFIX}${treeId}`;
  // With signature: exact key for precise cache hits
  return `${PREFIX}${treeId}:${layoutSignature}`;
}

function getSessionStorage(): typeof chrome.storage.session | null {
  return globalThis.chrome?.storage?.session ?? null;
}

export async function writeLayoutCache(result: CachedLayoutResult): Promise<void> {
  const storage = getSessionStorage();
  if (!storage) return;
  // Write to both exact key (signature match) and base key (fallback for consumers
  // that don't know the state yet, e.g. spotlight-graph reads before knowing collapse state)
  await storage.set({
    [storageKey(result.treeId, result.layoutSignature)]: result,
    [storageKey(result.treeId)]: result,
  });
}

export async function readLayoutCache(
  treeId: string,
  layoutSignature?: string,
): Promise<CachedLayoutResult | null> {
  const storage = getSessionStorage();
  if (!storage) return null;
  // Try exact signature key first if provided
  if (layoutSignature !== undefined) {
    const exactKey = storageKey(treeId, layoutSignature);
    const exactData = await storage.get(exactKey);
    const exactEntry = exactData[exactKey] as CachedLayoutResult | undefined;
    if (exactEntry) return exactEntry;
    // Fall back to base key but validate the signature matches
    const baseKey = storageKey(treeId);
    const baseData = await storage.get(baseKey);
    const baseEntry = baseData[baseKey] as CachedLayoutResult | undefined;
    if (baseEntry && baseEntry.layoutSignature === layoutSignature) return baseEntry;
    // Signature mismatch — do not serve stale data
    return null;
  }
  // No signature provided — return base key entry as-is (best-effort)
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
