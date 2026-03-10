import { useEffect, useMemo, useRef, useState } from 'react';
import { getSpotlightTreePreview } from './rpc.js';
import { LRUMap } from './lru-map.js';
import type {
  SpotlightGraphPreviewData,
  SpotlightSearchResult,
  SpotlightSection,
} from './types.js';
import type { NodeId } from '@shared/types/ids.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SpotlightNodeTarget = {
  treeId: string;
  nodeId: NodeId;
};

// ---------------------------------------------------------------------------
// Pure helpers (exported for SpotlightRoot rendering)
// ---------------------------------------------------------------------------

export function resolveNodeTarget(item: SpotlightSearchResult | null): SpotlightNodeTarget | null {
  if (!item) return null;
  if (item.kind === 'node') {
    return { treeId: item.treeId, nodeId: item.nodeId };
  }
  if (item.kind === 'action' && item.target?.kind === 'node') {
    return { treeId: item.target.treeId, nodeId: item.target.nodeId };
  }
  return null;
}

export function resolvePreviewTreeId(item: SpotlightSearchResult | null): string | null {
  if (!item) return null;
  if (item.kind === 'node') return item.treeId;
  if (item.kind === 'tree') return item.treeId;
  if (item.target?.kind === 'node' || item.target?.kind === 'tree') {
    return item.target.treeId;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Prefetch
// ---------------------------------------------------------------------------

const PREFETCH_LIMIT = 3;

function prefetchPreviews(
  sections: SpotlightSection[],
  activeTreeId: string | null,
  cache: LRUMap<string, SpotlightGraphPreviewData>,
  inflight: Set<string>,
): void {
  const seen = new Set<string>();
  const treeIds: string[] = [];

  for (const section of sections) {
    for (const item of section.items) {
      if (treeIds.length >= PREFETCH_LIMIT) return;
      const treeId = item.kind === 'node' ? item.treeId : item.kind === 'tree' ? item.treeId : null;
      if (!treeId || treeId === activeTreeId || cache.has(treeId) || seen.has(treeId) || inflight.has(treeId)) continue;
      seen.add(treeId);
      treeIds.push(treeId);
    }
  }

  for (const treeId of treeIds) {
    inflight.add(treeId);
    void getSpotlightTreePreview(treeId)
      .then((preview) => {
        if (preview) cache.set(treeId, preview);
      })
      .catch(() => undefined)
      .finally(() => {
        inflight.delete(treeId);
      });
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

type UseSpotlightPreviewOptions = {
  activeTreeId: string | null;
  drilldownScope: { treeId: string; treeName: string } | null;
  effectiveItem: SpotlightSearchResult | null;
  hoveredGraphTarget: SpotlightNodeTarget | null;
  sections: SpotlightSection[];
  previewCache: LRUMap<string, SpotlightGraphPreviewData>;
};

type UseSpotlightPreviewReturn = {
  previewTreeId: string | null;
  graphPreviewData: SpotlightGraphPreviewData | null;
  graphPreviewLoading: boolean;
  setGraphPreviewData: (data: SpotlightGraphPreviewData | null) => void;
  setGraphPreviewLoading: (loading: boolean) => void;
  echoIndex: Map<string, SpotlightSearchResult>;
};

export function useSpotlightPreview(
  options: UseSpotlightPreviewOptions,
): UseSpotlightPreviewReturn {
  const {
    activeTreeId,
    drilldownScope,
    effectiveItem,
    hoveredGraphTarget,
    sections,
    previewCache,
  } = options;

  const [graphPreviewData, setGraphPreviewData] = useState<SpotlightGraphPreviewData | null>(null);
  const [graphPreviewLoading, setGraphPreviewLoading] = useState(false);
  const inflightRef = useRef(new Set<string>());

  // Echo index — O(1) lookup by treeId:nodeId
  const echoIndex = useMemo(() => {
    const index = new Map<string, SpotlightSearchResult>();
    for (const section of sections) {
      for (const item of section.items) {
        const target = resolveNodeTarget(item);
        if (target) {
          index.set(`${target.treeId}:${target.nodeId}`, item);
        }
      }
    }
    return index;
  }, [sections]);

  // Compute preview tree ID
  const previewTreeId = useMemo(() => {
    if (drilldownScope) return drilldownScope.treeId;
    const candidate = hoveredGraphTarget?.treeId ?? resolvePreviewTreeId(effectiveItem);
    if (!candidate || !activeTreeId || candidate === activeTreeId) {
      return null;
    }
    return candidate;
  }, [activeTreeId, drilldownScope, effectiveItem, hoveredGraphTarget]);

  // Fetch preview data
  useEffect(() => {
    let cancelled = false;

    if (!previewTreeId) {
      setGraphPreviewData(null);
      setGraphPreviewLoading(false);
      return;
    }

    const cached = previewCache.get(previewTreeId) ?? null;
    if (cached) {
      setGraphPreviewData(cached);
      setGraphPreviewLoading(false);
      return;
    }

    setGraphPreviewLoading(true);
    void getSpotlightTreePreview(previewTreeId)
      .then((preview) => {
        if (cancelled) return;
        if (preview) {
          previewCache.set(previewTreeId, preview);
          setGraphPreviewData(preview);
        } else {
          setGraphPreviewData(null);
        }
      })
      .catch((error) => {
        console.error('Failed to load spotlight graph preview:', error);
        if (!cancelled) {
          setGraphPreviewData(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGraphPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [previewTreeId, previewCache]);

  // Prefetch on section changes
  useEffect(() => {
    prefetchPreviews(sections, activeTreeId, previewCache, inflightRef.current);
  }, [sections, activeTreeId, previewCache]);

  return {
    previewTreeId,
    graphPreviewData,
    graphPreviewLoading,
    setGraphPreviewData,
    setGraphPreviewLoading,
    echoIndex,
  };
}
