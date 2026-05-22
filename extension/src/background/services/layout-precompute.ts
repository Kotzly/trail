/**
 * Pre-computes fully-expanded graph positions in the background so the
 * sidepanel can skip the layout step on open.
 */

import { computeTreePositionsRecord } from "@features/graph/tree-layout.js";
import { layoutPositionsCacheItem } from "@shared/config/storage-items.js";
import { getSpacing } from "@shared/layout/spacing.js";
import { createLogger } from "@shared/lib/logger.js";
import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import type { NodeId } from "@shared/types/ids.js";
import type { Settings } from "@shared/types/settings.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import { settingsManager } from "./settings.js";
import { treeStorage } from "./tree-storage.js";
import {
  createLayoutCacheContext,
  createLayoutCacheKey,
  pruneLayoutCacheEntries,
  type LayoutCacheContext,
  type LayoutPositions,
  type LayoutPositionsCacheEntry,
} from "./layout-cache-signature.js";

const log = createLogger("layout-precompute");

let computeVersion = 0;
const memoryCache = new Map<string, LayoutPositionsCacheEntry>();
const inflightByKey = new Map<string, Promise<{ positions: LayoutPositions; applied: boolean }>>();

export {
  createLayoutCacheContext,
  createLayoutCacheKey,
  pruneLayoutCacheEntries,
  type LayoutCacheContext,
  type LayoutPositions,
  type LayoutPositionsCacheEntry,
};

function cacheEntryMatches(entry: LayoutPositionsCacheEntry, context: LayoutCacheContext): boolean {
  return (
    entry.treeId === context.treeId &&
    entry.savedAt === context.savedAt &&
    entry.layoutMode === context.layoutMode &&
    entry.graphDensity === context.graphDensity
  );
}

async function writeCacheEntry(entry: LayoutPositionsCacheEntry): Promise<void> {
  const key = createLayoutCacheKey(entry);

  for (const [candidateKey, candidateEntry] of memoryCache.entries()) {
    const sameLayoutFamily =
      candidateEntry.treeId === entry.treeId &&
      candidateEntry.layoutMode === entry.layoutMode &&
      candidateEntry.graphDensity === entry.graphDensity;

    if (sameLayoutFamily && candidateKey !== key) {
      memoryCache.delete(candidateKey);
    }
  }

  memoryCache.set(key, entry);

  try {
    const currentEntries = await layoutPositionsCacheItem.getValue();
    const nextEntries = pruneLayoutCacheEntries(currentEntries, entry);
    nextEntries[key] = entry;
    await layoutPositionsCacheItem.setValue(nextEntries);
  } catch (error) {
    log.warn("Failed to persist layout cache entry", {
      error: error instanceof Error ? error.message : String(error),
      treeId: entry.treeId,
    });
  }
}

export async function getCachedPositions(
  context: LayoutCacheContext,
): Promise<LayoutPositions | null> {
  const key = createLayoutCacheKey(context);
  const memoryEntry = memoryCache.get(key);
  if (memoryEntry && cacheEntryMatches(memoryEntry, context)) {
    return memoryEntry.positions;
  }

  try {
    const storedEntries = await layoutPositionsCacheItem.getValue();
    const storedEntry = storedEntries[key];
    if (!storedEntry || !cacheEntryMatches(storedEntry, context)) {
      return null;
    }
    memoryCache.set(key, storedEntry);
    return storedEntry.positions;
  } catch (error) {
    log.warn("Failed to read layout cache entry", {
      error: error instanceof Error ? error.message : String(error),
      treeId: context.treeId,
    });
    return null;
  }
}

export async function getActiveLayoutCacheContext(settings: Settings): Promise<LayoutCacheContext> {
  const { treeStorage } = await import("./tree-storage.js");
  const [meta, savedAt] = await Promise.all([
    treeStorage.getActiveMeta(),
    treeStorage.getActiveSavedAt(),
  ]);
  return createLayoutCacheContext(meta.id, savedAt, settings);
}

export function computePositions(
  tree: NavigationTreeJSON,
  settings: Settings,
): LayoutPositions | null {
  const collapsedNodeIds = new Set<NodeId>();
  const { nodeSpacing, layerSpacing } = getSpacing(settings.graphDensity);
  return computeTreePositionsRecord({
    tree,
    collapsedNodeIds,
    mode: settings.layout.mode,
    nodeSpacing,
    layerSpacing,
  });
}

/**
 * True when every node in `tree` has a corresponding entry in `positions`.
 * Used to skip stale cached positions after a mutation — savedAt only bumps
 * on the debounced save (~1.5s), so just-added nodes would otherwise ship
 * with no position and render at (0, 0) until the next snapshot arrives.
 */
export function positionsCoverTree(tree: NavigationTreeJSON, positions: LayoutPositions): boolean {
  if (!tree.root) return true;
  const stack = [tree.root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (!Object.prototype.hasOwnProperty.call(positions, String(node.id))) {
      return false;
    }
    for (const child of node.children) stack.push(child);
  }
  return true;
}

export async function precompute(
  tree: NavigationTreeJSON,
  settings: Settings,
  context: LayoutCacheContext,
): Promise<{ positions: LayoutPositions; applied: boolean }> {
  const key = createLayoutCacheKey(context);
  const existing = inflightByKey.get(key);
  if (existing) {
    return existing;
  }

  const version = ++computeVersion;
  const promise = (async () => {
    const positions = computePositions(tree, settings);
    if (!positions) {
      throw new Error("Layout computation returned null");
    }
    await writeCacheEntry({ ...context, positions });
    return { positions, applied: computeVersion === version };
  })()
    .catch((error) => {
      log.warn("Layout precompute failed", {
        error: error instanceof Error ? error.message : String(error),
        treeId: context.treeId,
      });
      throw error;
    })
    .finally(() => {
      if (inflightByKey.get(key) === promise) {
        inflightByKey.delete(key);
      }
    });

  inflightByKey.set(key, promise);
  return promise;
}

export async function ensureCachedPositions(
  tree: NavigationTreeJSON,
  settings: Settings,
  context: LayoutCacheContext,
): Promise<LayoutPositions | null> {
  const cached = await getCachedPositions(context);
  if (cached) {
    return cached;
  }

  try {
    const { positions } = await precompute(tree, settings, context);
    return positions;
  } catch {
    return null;
  }
}

/**
 * Persist already-computed positions to the cache without re-running
 * the layout. Used by the sync inline-compute path in
 * `sendTreeNotification`: the caller computes positions synchronously
 * (so it can include them in the first `TREE_UPDATED`), then kicks
 * off cache persistence fire-and-forget so subsequent reads find them.
 */
export async function persistComputedPositions(
  positions: LayoutPositions,
  context: LayoutCacheContext,
): Promise<void> {
  try {
    await writeCacheEntry({ ...context, positions });
  } catch (error) {
    log.warn("persistComputedPositions failed", {
      error: error instanceof Error ? error.message : String(error),
      treeId: context.treeId,
    });
  }
}

export async function warmLayoutPositions(): Promise<void> {
  try {
    const settings = settingsManager.get();
    const tree = await treeStorage.getOrCreateTree();
    const treeJSON = NavigationTreeMapper.toJSON(tree);
    const context = await getActiveLayoutCacheContext(settings);
    await ensureCachedPositions(treeJSON, settings, context);
  } catch {
    // Non-critical: sidepanel can still compute locally if cache warmup fails.
  }
}
