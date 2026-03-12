import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bootstrapSpotlight,
  disposeSpotlightSession,
  searchSpotlight,
} from './rpc.js';
import { LRUMap } from './lru-map.js';
import type {
  SpotlightBootstrapData,
  SpotlightGraphPreviewData,
  SpotlightSearchSessionId,
  SpotlightSection,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEARCH_LIMIT = 80;
const BACKOFF_DELAYS = [200, 800, 2000] as const;
const SESSION_MEMORY_TTL_MS = 3 * 60 * 1000; // 3 minutes

function computeDebounceMs(docCount: number): number {
  if (docCount < 200) return 0;
  if (docCount < 1000) return 40;
  if (docCount < 5000) return 80;
  return 150;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isConnectionError(error: unknown): boolean {
  const msg = (error as Error)?.message ?? '';
  return (
    msg.includes('Could not establish connection')
    || msg.includes('Extension context invalidated')
    || msg.includes('Receiving end does not exist')
  );
}

function isSessionExpired(error: unknown): boolean {
  return (error as Error)?.message === 'SESSION_EXPIRED';
}

function isRecoverableError(error: unknown): boolean {
  return isSessionExpired(error) || isConnectionError(error);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

type UseSpotlightSearchOptions = {
  isOpen: boolean;
  drilldownScopeTreeId: string | null;
};

type UseSpotlightSearchReturn = {
  sessionId: SpotlightSearchSessionId | null;
  bootstrapData: SpotlightBootstrapData | null;
  sections: SpotlightSection[];
  loading: boolean;
  sessionError: string | null;
  query: string;
  setQuery: (q: string) => void;
  previewCache: LRUMap<string, SpotlightGraphPreviewData>;
  recentQueries: string[];
  retryBootstrap: () => void;
};

export function useSpotlightSearch(
  options: UseSpotlightSearchOptions,
): UseSpotlightSearchReturn {
  const { isOpen, drilldownScopeTreeId } = options;

  const [bootstrapData, setBootstrapData] = useState<SpotlightBootstrapData | null>(null);
  const [sessionId, setSessionId] = useState<SpotlightSearchSessionId | null>(null);
  const [sections, setSections] = useState<SpotlightSection[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);

  const retryBootstrap = useCallback(() => {
    setSessionError(null);
    setBootstrapAttempt((c) => c + 1);
  }, []);

  const requestSeqRef = useRef(0);
  const previewCacheRef = useRef(new LRUMap<string, SpotlightGraphPreviewData>(16));
  const prevActiveTreeIdRef = useRef<string | null>(null);
  const currentQueryRef = useRef('');
  currentQueryRef.current = query;
  const sessionMemoryRef = useRef<{ query: string; savedAt: number } | null>(null);
  const memoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bootstrap on open
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);
    setSessionError(null);

    bootstrapSpotlight(SEARCH_LIMIT)
      .then((data) => {
        if (cancelled) return;
        if (data.activeTreeId !== prevActiveTreeIdRef.current) {
          previewCacheRef.current.clear();
        }
        prevActiveTreeIdRef.current = data.activeTreeId;
        setBootstrapData(data);
        setSessionId(data.sessionId);
        setSections(data.sections);
        setLoading(false);

        // Restore query from session memory if recent
        const memory = sessionMemoryRef.current;
        if (memory && Date.now() - memory.savedAt < SESSION_MEMORY_TTL_MS) {
          setQuery(memory.query);
        }
        sessionMemoryRef.current = null;
      })
      .catch((error) => {
        console.error('Failed to bootstrap spotlight:', error);
        if (!cancelled) {
          setSessionError('Failed to initialize spotlight');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, bootstrapAttempt]);

  // Search with debounce
  useEffect(() => {
    if (!isOpen || !sessionId) return;

    let cancelled = false;
    const timeout = setTimeout(() => {
      requestSeqRef.current += 1;
      const requestSeq = requestSeqRef.current;
      setLoading(true);

      searchSpotlight(sessionId, query, SEARCH_LIMIT, requestSeq, drilldownScopeTreeId ?? undefined)
        .then((response) => {
          if (cancelled) return;
          if (response.requestSeq !== requestSeqRef.current) return;
          setSections(response.sections);
          setLoading(false);
        })
        .catch(async (error) => {
          if (cancelled) return;
          if (isRecoverableError(error)) {
            await attemptRecovery();
            return;
          }
          console.error('Failed to search spotlight:', error);
          if (!cancelled) setLoading(false);
        });
    }, computeDebounceMs(bootstrapData?.docCount ?? 500));

    async function attemptRecovery(): Promise<void> {
      for (let attempt = 0; attempt < BACKOFF_DELAYS.length; attempt++) {
        if (cancelled) return;
        await sleep(BACKOFF_DELAYS[attempt]!);
        if (cancelled) return;
        try {
          const data = await bootstrapSpotlight(SEARCH_LIMIT);
          if (cancelled) return;
          if (data.activeTreeId !== prevActiveTreeIdRef.current) {
            previewCacheRef.current.clear();
          }
          prevActiveTreeIdRef.current = data.activeTreeId;
          setBootstrapData(data);
          setSessionId(data.sessionId);
          setSections(data.sections);
          setLoading(false);
          return;
        } catch (retryError) {
          console.error(`Recovery attempt ${attempt + 1} failed:`, retryError);
        }
      }
      // All retries exhausted
      if (!cancelled) {
        setSessionError('All session recovery attempts failed');
        setLoading(false);
      }
    }

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isOpen, query, sessionId, drilldownScopeTreeId]);

  // Dispose on close, reset state (preserve query in session memory)
  useEffect(() => {
    if (isOpen) return;

    // Save current query to session memory before clearing
    const savedQuery = currentQueryRef.current;
    if (savedQuery) {
      sessionMemoryRef.current = { query: savedQuery, savedAt: Date.now() };
      if (memoryTimerRef.current) clearTimeout(memoryTimerRef.current);
      memoryTimerRef.current = setTimeout(() => {
        sessionMemoryRef.current = null;
        memoryTimerRef.current = null;
      }, SESSION_MEMORY_TTL_MS);
    }

    setQuery('');
    requestSeqRef.current += 1;

    const activeSession = sessionId;
    setSessionId(null);
    if (activeSession) {
      void disposeSpotlightSession(activeSession).catch(() => undefined);
    }
  }, [isOpen, sessionId]);

  // Dispose on unmount
  useEffect(() => {
    return () => {
      if (!sessionId) return;
      void disposeSpotlightSession(sessionId).catch(() => undefined);
    };
  }, [sessionId]);

  return {
    sessionId,
    bootstrapData,
    sections,
    loading,
    sessionError,
    query,
    setQuery,
    previewCache: previewCacheRef.current,
    recentQueries: bootstrapData?.recentQueries ?? [],
    retryBootstrap,
  };
}
