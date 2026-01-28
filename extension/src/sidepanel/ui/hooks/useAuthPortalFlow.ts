import { useCallback, useEffect, useRef, useState } from 'react';
import type { Url } from '../../../shared/types/ids.js';
import type { AccountError } from '../../../shared/types/account.js';
import {
  BACKEND_CONFIG,
  checkAuthPortal,
  getAccountSnapshot,
  normalizeAccountError,
  startAuthPortal,
} from '../../api/account.js';
import { useStore } from '../state/store.js';

const sleep = (ms: number) => new Promise((resolve) => globalThis.setTimeout(resolve, ms));

const resolveDeadline = (expiresAt?: string | null): number => {
  if (!expiresAt) return Date.now() + 5 * 60 * 1000;
  const parsed = Date.parse(expiresAt);
  return Number.isNaN(parsed) ? Date.now() + 5 * 60 * 1000 : parsed;
};

type AuthFlowOptions = {
  source?: string;
  returnUrl?: Url;
};

type AuthFlowState = {
  busy: boolean;
  notice: string | null;
  error: AccountError | null;
  startAuthFlow: (options?: AuthFlowOptions) => Promise<void>;
  cancelAuthFlow: () => void;
  setNotice: (value: string | null) => void;
};

export function useAuthPortalFlow(): AuthFlowState {
  const setAccount = useStore((state) => state.setAccount);
  const setAccountSnapshot = useStore((state) => state.setAccountSnapshot);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<AccountError | null>(null);
  const flowRef = useRef(0);

  const openExternalLink = useCallback(async (url: Url) => {
    try {
      await chrome.tabs.create({ url, active: true });
    } catch (err) {
      console.error('Failed to open external link:', err);
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
    }
  }, []);

  const syncAccountSnapshot = useCallback(async () => {
    setAccount({ status: 'loading', error: null });
    const snapshot = await getAccountSnapshot();
    setAccountSnapshot(snapshot);
  }, [setAccount, setAccountSnapshot]);

  const startAuthFlow = useCallback(
    async (options?: AuthFlowOptions) => {
      if (busy) return;
      setBusy(true);
      setNotice(null);
      setError(null);
      setAccount({ status: 'loading', error: null });
      flowRef.current += 1;
      const flowId = flowRef.current;
      try {
        const portalSession = await startAuthPortal({
          source: options?.source ?? 'extension',
          locale: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
          returnUrl: options?.returnUrl ?? (BACKEND_CONFIG.portalUrl as Url),
        });
        await openExternalLink(portalSession.url);
        setNotice('Complete sign-in in the opened tab. Waiting for confirmation…');
        const deadline = resolveDeadline(portalSession.expiresAt);
        const pollInterval = portalSession.pollIntervalMs ?? 3000;
        while (flowRef.current === flowId) {
          if (Date.now() > deadline) {
            setNotice('Sign-in link expired. Please try again.');
            setAccount({ status: 'ready', error: null });
            break;
          }
          await sleep(pollInterval);
          const status = await checkAuthPortal(portalSession.id);
          if (flowRef.current !== flowId) return;
          if (status.status === 'approved') {
            if (status.snapshot) {
              setAccountSnapshot(status.snapshot);
            } else {
              await syncAccountSnapshot();
            }
            setNotice(null);
            return;
          }
          if (status.status === 'expired') {
            setNotice('Sign-in link expired. Please try again.');
            setAccount({ status: 'ready', error: null });
            return;
          }
        }
      } catch (err) {
        const normalized = normalizeAccountError(err);
        setError(normalized);
        setAccount({
          status: 'error',
          error: normalized,
          network: normalized.code === 'network' ? 'offline' : 'online',
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, openExternalLink, setAccount, setAccountSnapshot, syncAccountSnapshot],
  );

  const cancelAuthFlow = useCallback(() => {
    flowRef.current += 1;
    setBusy(false);
    setNotice(null);
  }, []);

  useEffect(() => {
    return () => {
      flowRef.current += 1;
    };
  }, []);

  return { busy, notice, error, startAuthFlow, cancelAuthFlow, setNotice };
}
