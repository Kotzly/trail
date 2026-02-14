import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AccountError } from '../../../shared/types/account.js';
import {
  getAccountSnapshot,
  normalizeAccountError,
  requestOauthInteractiveLoginFromBackground,
  requestOauthSilentSyncFromBackground,
} from '../../api/account.js';
import { useStore } from '../state/store.js';
import { accountKeys } from '../query/account-keys.js';
import { showUiToast } from '../notifications/sonner-adapter.js';


type AuthFlowState = {
  busy: boolean;
  silentSyncing: boolean;
  notice: string | null;
  error: AccountError | null;
  startAuthFlow: () => Promise<void>;
  cancelAuthFlow: () => void;
  setNotice: (value: string | null) => void;
};

export function useAuthPortalFlow(): AuthFlowState {
  const queryClient = useQueryClient();
  const setAccount = useStore((state) => state.setAccount);
  const setAccountSnapshot = useStore((state) => state.setAccountSnapshot);

  const [busy, setBusy] = useState(false);
  const [silentSyncing, setSilentSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<AccountError | null>(null);
  const silentAttemptedRef = useRef(false);

  const syncAccountSnapshot = useCallback(async () => {
    setAccount({ status: 'loading', error: null });
    const snapshot = await queryClient.fetchQuery({
      queryKey: accountKeys.snapshot(),
      queryFn: getAccountSnapshot,
    });
    setAccountSnapshot(snapshot);
  }, [queryClient, setAccount, setAccountSnapshot]);

  const waitForWebsiteLogin = useCallback(async (): Promise<boolean> => {
    const startedAt = Date.now();
    const timeoutMs = 60_000;
    const intervalMs = 1_500;

    while (Date.now() - startedAt < timeoutMs) {
      try {
        const silent = await requestOauthSilentSyncFromBackground();
        if (!silent.ok && silent.reason !== 'login_required') {
          return false;
        }

        const snapshot = await queryClient.fetchQuery({
          queryKey: accountKeys.snapshot(),
          queryFn: getAccountSnapshot,
          staleTime: 0,
        });
        if (snapshot.session.status === 'authenticated' && snapshot.user) {
          setAccountSnapshot(snapshot);
          void queryClient.invalidateQueries({ queryKey: accountKeys.snapshot() });
          return true;
        }
      } catch {
        // keep waiting until timeout
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return false;
  }, [queryClient, setAccountSnapshot]);

  const startAuthFlow = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice('Opening sign-in…');
    setAccount({ status: 'loading', error: null });

    try {
      const result = await requestOauthInteractiveLoginFromBackground();
      if (!result.ok) {
        throw new Error(result.reason || 'Sign-in failed');
      }

      if (result.reason === 'opened_login_tab') {
        setNotice('Waiting for sign in…');
        const completed = await waitForWebsiteLogin();
        if (!completed) {
          throw new Error('Sign-in did not complete in time');
        }
        setNotice(null);
      } else {
        await syncAccountSnapshot();
        void queryClient.invalidateQueries({ queryKey: accountKeys.snapshot() });
        setNotice(null);
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
      setNotice(null);
    } finally {
      setBusy(false);
    }
  }, [busy, queryClient, setAccount, syncAccountSnapshot, waitForWebsiteLogin]);

  const trySilentSync = useCallback(async () => {
    if (busy || silentSyncing || silentAttemptedRef.current) {
      return;
    }
    silentAttemptedRef.current = true;

    setSilentSyncing(true);
    setNotice('Checking web session…');
    try {
      const result = await requestOauthSilentSyncFromBackground();
      if (!result.ok) {
        setNotice(null);
        return;
      }

      await syncAccountSnapshot();
      void queryClient.invalidateQueries({ queryKey: accountKeys.snapshot() });
      setNotice(null);
    } catch {
      setNotice(null);
    } finally {
      setSilentSyncing(false);
    }
  }, [busy, queryClient, silentSyncing, syncAccountSnapshot]);

  const cancelAuthFlow = useCallback(() => {
    setBusy(false);
    setNotice(null);
  }, []);

  useEffect(() => {
    void trySilentSync();
  }, [trySilentSync]);

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
