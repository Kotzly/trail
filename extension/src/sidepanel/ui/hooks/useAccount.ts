import { useEffect, useRef } from 'react';
import { normalizeAccountError } from '../../api/account.js';
import { useStore } from '../state/store.js';
import { useAccountSnapshotQuery } from '../query/useAccountSnapshotQuery.js';
import { showUiToast } from '../notifications/sonner-adapter.js';


export function useAccount(): void {
  const setAccount = useStore((state) => state.setAccount);
  const setAccountSnapshot = useStore((state) => state.setAccountSnapshot);
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
}
