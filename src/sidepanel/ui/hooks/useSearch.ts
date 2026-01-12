import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store.js';
import type { NodeId } from '../../../shared/types/ids.js';
import {
  acceptTempSelection,
  beginTempSelection,
  cancelTempSelection,
  endTempSelection,
  previewTempSelection,
} from '../../api/tree.js';


export function useSearch() {
  const tree = useStore((state) => state.tree);
  const search = useStore((state) => state.search);
  const currentNodeId = useStore((state) => state.currentNodeId);
  const setSearch = useStore((state) => state.setSearch);
  const setSearchIndex = useStore((state) => state.setSearchIndex);
  const clearSearch = useStore((state) => state.clearSearch);
  const lastPreviewRef = useRef<NodeId | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionPromiseRef = useRef<Promise<string | null> | null>(null);

  const ensureSession = useCallback(
    async (baseId: NodeId | null) => {
      if (sessionId) return sessionId;
      if (!sessionPromiseRef.current) {
        sessionPromiseRef.current = beginTempSelection({
          baseNodeId: baseId ?? null,
          options: {
            allowCreateOnCommit: false,
            allowPreviewWithoutTabs: true,
          },
        })
          .then((result) => {
            setSessionId(result.sessionId);
            return result.sessionId;
          })
          .catch((error) => {
            console.error('Failed to begin temp selection:', error);
            return null;
          })
          .finally(() => {
            sessionPromiseRef.current = null;
          });
      }
      return sessionPromiseRef.current;
    },
    [sessionId],
  );

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
      if (sessionId) {
        endTempSelection(sessionId).catch((error) =>
          console.error('Failed to end temp selection:', error),
        );
        setSessionId(null);
      }
      if (sessionPromiseRef.current) {
        sessionPromiseRef.current
          .then((id) => {
            if (id) {
              endTempSelection(id).catch((error) =>
                console.error('Failed to end temp selection:', error),
              );
            }
          })
          .catch(() => undefined);
        sessionPromiseRef.current = null;
      }
      return;
    }
    if (!sessionId) return;
    const nodeId = search.results[search.index];
    if (!nodeId || lastPreviewRef.current === nodeId) return;
    lastPreviewRef.current = nodeId;
    previewTempSelection(sessionId, nodeId).catch((error) =>
      console.error('Failed to preview node:', error),
    );
  }, [search.active, search.index, search.results, sessionId]);

  useEffect(() => {
    if (!search.active) return;
    if (sessionId || sessionPromiseRef.current) return;
    void ensureSession(search.baseCurrentId ?? currentNodeId ?? null);
  }, [currentNodeId, ensureSession, search.active, search.baseCurrentId, sessionId]);

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
      if (!search.active) {
        void ensureSession(baseCurrentId ?? null);
      }
    },
    [clearSearch, currentNodeId, ensureSession, search.active, search.baseCurrentId, setSearch, tree],
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
    if (!sessionId) return;
    if (search.results.length === 0) return;
    const nodeId = search.results[search.index];
    if (!nodeId) return;
    try {
      await acceptTempSelection(sessionId, nodeId);
    } catch (error) {
      console.error('Failed to accept search selection:', error);
    } finally {
      clearSearch();
      setSessionId(null);
    }
  }, [acceptTempSelection, clearSearch, search.index, search.results, sessionId]);

  const cancelSelection = useCallback(async () => {
    if (!sessionId) {
      clearSearch();
      return;
    }
    try {
      await cancelTempSelection(sessionId);
    } catch (error) {
      console.error('Failed to cancel search selection:', error);
    } finally {
      clearSearch();
      setSessionId(null);
    }
  }, [cancelTempSelection, clearSearch, sessionId]);

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
