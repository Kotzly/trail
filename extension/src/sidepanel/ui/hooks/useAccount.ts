import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { normalizeAccountError } from '../../api/account.js';
import { useStore } from '../state/store.js';
import { useAccountSnapshotQuery } from '../query/useAccountSnapshotQuery.js';
import { showUiToast } from '../notifications/sonner-adapter.js';
import { accountKeys } from '../query/account-keys.js';

const AUTH_STORAGE_KEY = 'trail_auth_session' as const;

export function useAccount(): void {
  const queryClient = useQueryClient();
  const setAccount = useStore((state) => state.setAccount);
  const setAccountSnapshot = useStore((state) => state.setAccountSnapshot);
  const resetAccount = useStore((state) => state.resetAccount);
  const snapshotQuery = useAccountSnapshotQuery();
  const lastErrorKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const updateNetwork = (online: boolean) => {
      setAccount({ network: online ? 'online' : 'offline' });
    };

    const handleOnline = () => updateNetwork(true);
    const handleOffline = () => updateNetwork(false);

    if (window) {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      updateNetwork(navigator.onLine);
    }

    return () => {
      if (window) {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, [setAccount]);

  useEffect(() => {
    if (snapshotQuery.isPending) {
      setAccount({ status: 'loading', error: null });
      return;
    }

    if (snapshotQuery.isSuccess) {
      lastErrorKeyRef.current = null;
      setAccountSnapshot(snapshotQuery.data);
      return;
    }

    if (snapshotQuery.isError) {
      const normalized = normalizeAccountError(snapshotQuery.error);
      const errorKey = `${normalized.code}:${normalized.message}`;
      if (lastErrorKeyRef.current !== errorKey) {
        lastErrorKeyRef.current = errorKey;
        showUiToast({
          message: normalized.message,
          icon: 'AlertTriangle',
          durationMs: 5000,
        });
      }
      setAccount({
        status: 'error',
        error: normalized,
        network: normalized.code === 'network' ? 'offline' : 'online',
      });
    }
  }, [setAccount, setAccountSnapshot, snapshotQuery.data, snapshotQuery.error, snapshotQuery.isError, snapshotQuery.isPending, snapshotQuery.isSuccess]);

  useEffect(() => {
    const hasChromeStorage =
      typeof chrome !== 'undefined' && Boolean(chrome.storage?.onChanged);
    if (!hasChromeStorage) {
      return;
    }

    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== 'local' || !(AUTH_STORAGE_KEY in changes)) {
        return;
      }

      const change = changes[AUTH_STORAGE_KEY];
      const oldToken = (change?.oldValue as { accessToken?: string } | undefined)
        ?.accessToken;
      const nextToken = (change?.newValue as { accessToken?: string } | undefined)
        ?.accessToken;

      if (oldToken && !nextToken) {
        queryClient.removeQueries({ queryKey: accountKeys.root });
        resetAccount();
        return;
      }

      if (!oldToken && nextToken) {
        void queryClient.invalidateQueries({ queryKey: accountKeys.snapshot() });
      }
    };

    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => {
      chrome.storage.onChanged.removeListener(onStorageChanged);
    };
  }, [queryClient, resetAccount]);
}
