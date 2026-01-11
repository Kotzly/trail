import { useCallback, useEffect } from 'react';
import { useStore } from '../state/store.js';


export function useSearch() {
  const tree = useStore((state) => state.tree);
  const search = useStore((state) => state.search);
  const setSearch = useStore((state) => state.setSearch);
  const setSearchIndex = useStore((state) => state.setSearchIndex);
  const clearSearch = useStore((state) => state.clearSearch);

  useEffect(() => {
    if (!search.query) return;
    const results = tree ? tree.findNodesByQuery(search.query) : [];
    setSearch(search.query, results, Math.min(search.index, Math.max(0, results.length - 1)));
  }, [search.index, search.query, setSearch, tree]);

  const performSearch = useCallback(
    (query: string) => {
      if (!query) {
        clearSearch();
        return;
      }
      const results = tree ? tree.findNodesByQuery(query) : [];
      setSearch(query, results, 0);
    },
    [clearSearch, setSearch, tree],
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

  return {
    search,
    performSearch,
    clearSearch,
    nextResult,
    prevResult,
  };
}
