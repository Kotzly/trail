import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../state/store.js';
import type { NodeId } from '../../../shared/types/ids.js';
import { previewNode, setCurrentNode } from '../../api/tree.js';


export function useSearch() {
  const tree = useStore((state) => state.tree);
  const search = useStore((state) => state.search);
  const currentNodeId = useStore((state) => state.currentNodeId);
  const setSearch = useStore((state) => state.setSearch);
  const setSearchIndex = useStore((state) => state.setSearchIndex);
  const clearSearch = useStore((state) => state.clearSearch);
  const lastPreviewRef = useRef<NodeId | null>(null);

  useEffect(() => {
    if (!search.query) return;
    const results = tree ? tree.findNodesByQuery(search.query) : [];
    setSearch(
      search.query,
      results,
      Math.min(search.index, Math.max(0, results.length - 1)),
      search.baseCurrentId ?? currentNodeId ?? null,
    );
  }, [currentNodeId, search.baseCurrentId, search.index, search.query, setSearch, tree]);

  useEffect(() => {
    if (!search.active) {
      lastPreviewRef.current = null;
      return;
    }
    const nodeId = search.results[search.index];
    if (!nodeId || lastPreviewRef.current === nodeId) return;
    lastPreviewRef.current = nodeId;
    previewNode(nodeId).catch((error) => console.error('Failed to preview node:', error));
  }, [previewNode, search.active, search.index, search.results]);

  useEffect(() => {
    if (!search.active) return;
    if (!currentNodeId || !search.baseCurrentId) return;
    if (currentNodeId !== search.baseCurrentId) {
      clearSearch();
    }
  }, [clearSearch, currentNodeId, search.active, search.baseCurrentId]);

  const performSearch = useCallback(
    (query: string) => {
      if (!query) {
        clearSearch();
        return;
      }
      const results = tree ? tree.findNodesByQuery(query) : [];
      const baseCurrentId = search.active ? search.baseCurrentId : currentNodeId;
      setSearch(query, results, 0, baseCurrentId ?? null);
    },
    [clearSearch, currentNodeId, search.active, search.baseCurrentId, setSearch, tree],
  );

  const focusResult = useCallback(
    (index: number) => {
      if (search.results.length === 0) return;
      setSearchIndex(index);
      const nextIndex =
        ((index % search.results.length) + search.results.length) % search.results.length;
    },
    [search.results, setSearchIndex],
  );

  const nextResult = useCallback(() => {
    if (search.results.length === 0) return;
    focusResult(search.index + 1);
  }, [focusResult, search.index, search.results.length]);

  const prevResult = useCallback(() => {
    if (search.results.length === 0) return;
    focusResult(search.index - 1);
  }, [focusResult, search.index, search.results.length]);

  const acceptSelection = useCallback(async () => {
    if (search.results.length === 0) return;
    const nodeId = search.results[search.index];
    if (!nodeId) return;
    try {
      await setCurrentNode(nodeId);
      clearSearch();
    } catch (error) {
      console.error('Failed to accept search selection:', error);
    }
  }, [clearSearch, search.index, search.results, setCurrentNode]);

  const cancelSelection = useCallback(async () => {
    const baseId = search.baseCurrentId;
    clearSearch();
    if (!baseId) return;
    try {
      await previewNode(baseId);
    } catch (error) {
      console.error('Failed to cancel search selection:', error);
    }
  }, [clearSearch, previewNode, search.baseCurrentId]);

  return {
    search,
    performSearch,
    clearSearch,
    nextResult,
    prevResult,
    acceptSelection,
    cancelSelection,
  };
}
