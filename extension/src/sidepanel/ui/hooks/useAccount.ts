import { useEffect } from 'react';
import { getAccountSnapshot, normalizeAccountError } from '../../api/account.js';
import { loadCachedSnapshot, saveCachedSnapshot } from '../../api/account/cache.js';
import { useStore } from '../state/store.js';


export function useAccount(): void {
  const setAccount = useStore((state: any) => state.setAccount);
  const setAccountSnapshot = useStore((state: any) => state.setAccountSnapshot);

  useEffect(() => {
    let mounted = true;

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

    const sync = async () => {
      setAccount({ status: 'loading', error: null });

      // Restore from cache — avoids network round-trip on every sidepanel open.
      const cached = await loadCachedSnapshot();
      if (cached && mounted) {
        setAccountSnapshot(cached);
        return;
      }

      // No cache — first launch or after clear; fetch from network.
      try {
        const snapshot = await getAccountSnapshot();
        if (!mounted) return;
        setAccountSnapshot(snapshot);
        void saveCachedSnapshot(snapshot);
      } catch (error) {
        if (!mounted) return;
        const normalized = normalizeAccountError(error);
        setAccount({
          status: 'error',
          error: normalized,
          network: normalized.code === 'network' ? 'offline' : 'online',
        });
      }
    };

    void sync();

    return () => {
      mounted = false;
      if (window) {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, [setAccount, setAccountSnapshot]);
}
