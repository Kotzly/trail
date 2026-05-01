import type { GraphDensity, LayoutMode, Settings } from "@shared/types/settings.js";

export type LayoutPositions = Record<string, { x: number; y: number }>;

export type LayoutCacheContext = {
  treeId: string;
  savedAt: number;
  layoutMode: LayoutMode;
  graphDensity: GraphDensity;
};

export type LayoutPositionsCacheEntry = LayoutCacheContext & {
  positions: LayoutPositions;
};

type LayoutSignatureInput = {
  layout: Pick<Settings["layout"], "mode">;
  graphDensity: Settings["graphDensity"];
};

export function createLayoutCacheContext(
  treeId: string,
  savedAt: number,
  settings: LayoutSignatureInput,
): LayoutCacheContext {
  return {
    treeId,
    savedAt,
    layoutMode: settings.layout.mode,
    graphDensity: settings.graphDensity,
  };
}

export function createLayoutCacheKey(context: LayoutCacheContext): string {
  return [context.treeId, String(context.savedAt), context.layoutMode, context.graphDensity].join(
    "|",
  );
}

export function pruneLayoutCacheEntries(
  entries: Record<string, LayoutPositionsCacheEntry>,
  context: LayoutCacheContext,
): Record<string, LayoutPositionsCacheEntry> {
  const next: Record<string, LayoutPositionsCacheEntry> = {};

  for (const [key, entry] of Object.entries(entries)) {
    const sameLayoutFamily =
      entry.treeId === context.treeId &&
      entry.layoutMode === context.layoutMode &&
      entry.graphDensity === context.graphDensity;

    if (!sameLayoutFamily) {
      next[key] = entry;
    }
  }

  return next;
}
