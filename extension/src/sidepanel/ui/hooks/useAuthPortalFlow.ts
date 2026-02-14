import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Url } from '../../../shared/types/ids.js';
import type { AccountError } from '../../../shared/types/account.js';
import { getBackendConfig, initBackendConfig } from '../../../shared/config/backend.js';
import {
  exchangeAuthBridgeCode,
  getAccountSnapshot,
  normalizeAccountError,
  requestWebAuthBridgeCodeFromBackground,
} from '../../api/account.js';
import { useStore } from '../state/store.js';
import { accountKeys } from '../query/account-keys.js';
import { useAuthMutations } from '../query/useAuthMutations.js';
import { showUiToast } from '../notifications/sonner-adapter.js';

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
  silentSyncing: boolean;
  notice: string | null;
  error: AccountError | null;
  startAuthFlow: (options?: AuthFlowOptions) => Promise<void>;
  cancelAuthFlow: () => void;
  setNotice: (value: string | null) => void;
};

export function useAuthPortalFlow(): AuthFlowState {
  const queryClient = useQueryClient();
  const setAccount = useStore((state) => state.setAccount);
  const setAccountSnapshot = useStore((state) => state.setAccountSnapshot);
  const { startAuthPortalMutation, checkAuthPortalMutation } = useAuthMutations();
  const [busy, setBusy] = useState(false);
  const [silentSyncing, setSilentSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<AccountError | null>(null);
  const flowRef = useRef(0);
  const silentAttemptedRef = useRef(false);

  const openExternalLink = useCallback(async (url: Url) => {
    try {
      await chrome.tabs.create({ url, active: true });
    } catch (err) {
      console.error('Failed to open external link:', err);
      if (window) {
        window.open(url, '_blank');
      }
    }
  }, []);

  const syncAccountSnapshot = useCallback(async () => {
    setAccount({ status: 'loading', error: null });
    const snapshot = await queryClient.fetchQuery({
      queryKey: accountKeys.snapshot(),
      queryFn: getAccountSnapshot,
    });
    setAccountSnapshot(snapshot);
  }, [queryClient, setAccount, setAccountSnapshot]);

  const startAuthFlow = useCallback(
    async (options?: AuthFlowOptions) => {
      if (busy) return;
      silentAttemptedRef.current = true;
      setBusy(true);
      setNotice(null);
      setError(null);
      setAccount({ status: 'loading', error: null });
      flowRef.current += 1;
      const flowId = flowRef.current;
      try {
        await initBackendConfig();
        const backendConfig = getBackendConfig();
        const portalSession = await startAuthPortalMutation.mutateAsync({
          source: options?.source ?? 'extension',
          locale: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
          returnUrl: options?.returnUrl ?? (backendConfig.portalUrl as Url),
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
          const status = await checkAuthPortalMutation.mutateAsync(portalSession.id);
          if (flowRef.current !== flowId) return;
          if (status.status === 'approved') {
            if (status.snapshot) {
              queryClient.setQueryData(accountKeys.snapshot(), status.snapshot);
              setAccountSnapshot(status.snapshot);
            } else {
              await syncAccountSnapshot();
            }
            void queryClient.invalidateQueries({ queryKey: accountKeys.snapshot() });
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
        showUiToast({
          message: normalized.message,
          icon: 'AlertTriangle',
          durationMs: 5000,
        });
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
    [busy, checkAuthPortalMutation, openExternalLink, queryClient, setAccount, setAccountSnapshot, startAuthPortalMutation, syncAccountSnapshot],
  );

  const trySilentWebBridge = useCallback(async () => {
    if (busy || silentSyncing || silentAttemptedRef.current) {
      return;
    }
    silentAttemptedRef.current = true;

    setSilentSyncing(true);
    setNotice('Checking web session…');
    try {
      const bridgeCode = await requestWebAuthBridgeCodeFromBackground();
      if (!bridgeCode?.code) {
        setNotice(null);
        return;
      }

      const snapshot = await exchangeAuthBridgeCode(bridgeCode.code);
      queryClient.setQueryData(accountKeys.snapshot(), snapshot);
      setAccountSnapshot(snapshot);
      void queryClient.invalidateQueries({ queryKey: accountKeys.snapshot() });
      setNotice(null);
    } catch {
      setNotice(null);
    } finally {
      setSilentSyncing(false);
    }
  }, [busy, queryClient, setAccountSnapshot, silentSyncing]);

  const cancelAuthFlow = useCallback(() => {
    flowRef.current += 1;
    setBusy(false);
    setNotice(null);
  }, []);

  useEffect(() => {
    void trySilentWebBridge();
  }, [trySilentWebBridge]);

  useEffect(() => {
    return () => {
      flowRef.current += 1;
    };
  }, []);

  return {
    busy,
    silentSyncing,
    notice,
    error,
    startAuthFlow,
    cancelAuthFlow,
    setNotice,
  };
}
