import { useState, useEffect, useCallback, useRef } from 'react';
import {
  bootstrapLegacySpotlight,
  disposeLegacySpotlightSession,
  searchLegacySpotlight,
  navigateLegacySpotlightNode,
  openLegacySpotlightTree,
} from './legacy-rpc.js';
import { SpotlightOverlay } from './SpotlightOverlay.js';
import type {
  LegacySpotlightBootstrapData,
  LegacySpotlightSearchResult,
  LegacySpotlightSearchSessionId,
} from './legacy-types.js';
import type { Url } from '@shared/types/ids.js';

type SpotlightLegacyAppProps = {
  onRegisterToggle: (toggle: () => void) => void;
};

const SEARCH_LIMIT = 80;
const SEARCH_DEBOUNCE_MS = 80;

export function SpotlightLegacyApp({ onRegisterToggle }: SpotlightLegacyAppProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);
  const [, setBootstrapData] = useState<LegacySpotlightBootstrapData | null>(null);
  const [sessionId, setSessionId] = useState<LegacySpotlightSearchSessionId | null>(null);
  const [results, setResults] = useState<LegacySpotlightSearchResult[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const requestSeqRef = useRef(0);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    onRegisterToggle(toggle);
  }, [onRegisterToggle, toggle]);

  useEffect(() => {
    if (isOpen) setHasBeenOpened(true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);

    bootstrapLegacySpotlight(SEARCH_LIMIT)
      .then((data) => {
        if (cancelled) return;
        setBootstrapData(data);
        setSessionId(data.sessionId);
        setResults(data.results);
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

  useEffect(() => {
    if (!isOpen || !sessionId) return;

    let cancelled = false;
    const timeout = setTimeout(() => {
      requestSeqRef.current += 1;
      const requestSeq = requestSeqRef.current;
      setLoading(true);

      searchLegacySpotlight(sessionId, query, SEARCH_LIMIT, requestSeq)
        .then((response) => {
          if (cancelled) return;
          if (response.requestSeq !== requestSeqRef.current) return;
          setResults(response.results);
          setLoading(false);
        })
        .catch(async (error) => {
          if (cancelled) return;
          if ((error as Error).message === 'SESSION_EXPIRED') {
            try {
              const data = await bootstrapLegacySpotlight(SEARCH_LIMIT);
              if (cancelled) return;
              setBootstrapData(data);
              setSessionId(data.sessionId);

              if (!query) {
                if (requestSeq === requestSeqRef.current) {
                  setResults(data.results);
                  setLoading(false);
                }
                return;
              }

              const recovered = await searchLegacySpotlight(data.sessionId, query, SEARCH_LIMIT, requestSeq);
              if (cancelled) return;
              if (recovered.requestSeq !== requestSeqRef.current) return;
              setResults(recovered.results);
              setLoading(false);
              return;
            } catch (retryError) {
              console.error('Failed to recover spotlight session:', retryError);
              setLoading(false);
              return;
            }
          }

          console.error('Failed to search spotlight:', error);
          setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isOpen, query, sessionId]);

  useEffect(() => {
    if (isOpen) return;

    setQuery('');
    requestSeqRef.current += 1;

    const activeSession = sessionId;
    setSessionId(null);

    if (activeSession) {
      void disposeLegacySpotlightSession(activeSession).catch(() => {
        // Best effort cleanup; session also expires server-side.
      });
    }
  }, [isOpen, sessionId]);

  useEffect(() => {
    return () => {
      if (!sessionId) return;
      void disposeLegacySpotlightSession(sessionId).catch(() => {
        // Best effort cleanup on unmount.
      });
    };
  }, [sessionId]);

  const themeTokens = null;

  const handleNavigate = useCallback(
    async (item: LegacySpotlightSearchResult) => {
      if (item.group === 'other-trees' && item.treeId) {
        await openLegacySpotlightTree(item.treeId);
      } else {
        await navigateLegacySpotlightNode(item.nodeId, item.url as Url);
      }
      close();
    },
    [close],
  );

  if (!hasBeenOpened) return null;

  return (
    <SpotlightOverlay
      isOpen={isOpen}
      suggestions={results}
      query={query}
      loading={loading}
      onQueryChange={setQuery}
      onActivate={handleNavigate}
      onClose={close}
      themeTokens={themeTokens}
    />
  );
}
