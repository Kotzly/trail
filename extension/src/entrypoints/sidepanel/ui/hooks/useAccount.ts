import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { normalizeAccountError } from '../../api/account.js';
import {
  authSessionItem,
  accountSnapshotItem,
  type StoredAuthSession,
} from '../../../../shared/config/storage-items.js';
import { useStore } from '../state/store.js';
import { useAccountSnapshotQuery } from '../query/useAccountSnapshotQuery.js';
import { showUiToast } from '../notifications/sonner-adapter.js';
import { accountKeys } from '../query/account-keys.js';

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
    // React to auth token changes (login/logout)
    const unwatchAuth = authSessionItem.watch((
      newVal: StoredAuthSession | null,
      oldVal: StoredAuthSession | null,
    ) => {
      const oldToken = oldVal?.accessToken;
      const nextToken = newVal?.accessToken;

      if (oldToken && !nextToken) {
        queryClient.removeQueries({ queryKey: accountKeys.root });
        resetAccount();
        setAccount({ sessionExpired: true });
        return;
      }

      if (!oldToken && nextToken) {
        void queryClient.invalidateQueries({ queryKey: accountKeys.snapshot() });
      }
    });

    // React to background snapshot cache updates
    const unwatchSnapshot = accountSnapshotItem.watch((newEnvelope) => {
      if (newEnvelope?.snapshot && typeof newEnvelope.fetchedAt === 'number') {
        queryClient.setQueryData(
          accountKeys.snapshot(),
          newEnvelope.snapshot,
          { updatedAt: newEnvelope.fetchedAt },
        );
      }
    });

    return () => {
      unwatchAuth();
      unwatchSnapshot();
    };
  }, [queryClient, resetAccount, setAccount]);
}
