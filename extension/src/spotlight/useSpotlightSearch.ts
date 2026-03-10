import { useEffect, useRef, useState } from 'react';
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
const SEARCH_DEBOUNCE_MS = 80;
const BACKOFF_DELAYS = [200, 800, 2000] as const;

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

  const requestSeqRef = useRef(0);
  const previewCacheRef = useRef(new LRUMap<string, SpotlightGraphPreviewData>(20));

  // Bootstrap on open
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);
    setSessionError(null);

    bootstrapSpotlight(SEARCH_LIMIT)
      .then((data) => {
        if (cancelled) return;
        previewCacheRef.current.clear();
        setBootstrapData(data);
        setSessionId(data.sessionId);
        setSections(data.sections);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to bootstrap spotlight:', error);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

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
            await attemptRecovery(cancelled);
            return;
          }
          console.error('Failed to search spotlight:', error);
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    async function attemptRecovery(alreadyCancelled: boolean): Promise<void> {
      for (let attempt = 0; attempt < BACKOFF_DELAYS.length; attempt++) {
        if (alreadyCancelled) return;
        await sleep(BACKOFF_DELAYS[attempt]!);
        try {
          const data = await bootstrapSpotlight(SEARCH_LIMIT);
          if (alreadyCancelled) return;
          previewCacheRef.current.clear();
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
      if (!alreadyCancelled) {
        setSessionError('All session recovery attempts failed');
        setLoading(false);
      }
    }

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isOpen, query, sessionId, drilldownScopeTreeId]);

  // Dispose on close, reset state
  useEffect(() => {
    if (isOpen) return;

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
  };
}
