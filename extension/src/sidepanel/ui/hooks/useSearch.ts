import { useCallback, useDeferredValue, useEffect, useRef } from 'react';
import { useStore } from '../state/store.js';


export function useSearch() {
  const tree = useStore((state) => state.tree);
  const search = useStore((state) => state.search);
  const currentNodeId = useStore((state) => state.currentNodeId);
  const setSearchQuery = useStore((state) => state.setSearchQuery);
  const setSearchResults = useStore((state) => state.setSearchResults);
  const setSearchIndex = useStore((state) => state.setSearchIndex);
  const clearSearch = useStore((state) => state.clearSearch);
  const searchIndexRef = useRef(search.index);
  const deferredQuery = useDeferredValue(search.query);

  useEffect(() => {
    searchIndexRef.current = search.index;
  }, [search.index]);

  useEffect(() => {
    if (!deferredQuery) return;
    if (!search.query) return;
    if (deferredQuery !== search.query) return;
    const results = tree ? tree.findNodesByQuery(deferredQuery) : [];
    const maxIndex = Math.max(0, results.length - 1);
    const nextIndex =
      results.length === 0 ? 0 : Math.min(Math.max(searchIndexRef.current, 0), maxIndex);
    setSearchResults(results, nextIndex);
  }, [deferredQuery, search.query, setSearchResults, tree]);

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
      const baseCurrentId = search.active ? search.baseCurrentId : currentNodeId;
      setSearchQuery(query, baseCurrentId ?? null);
    },
    [clearSearch, currentNodeId, search.active, search.baseCurrentId, setSearchQuery],
  );

  const focusResult = useCallback(
    (index: number) => {
      if (search.results.length === 0) return;
      const nextIndex =
        ((index % search.results.length) + search.results.length) % search.results.length;
      setSearchIndex(nextIndex);
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

  return {
    search,
    performSearch,
    clearSearch,
    nextResult,
    prevResult,
  };
}
