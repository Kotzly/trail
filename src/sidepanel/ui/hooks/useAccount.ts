import { useEffect } from 'react';
import { getAccountSnapshot, normalizeAccountError } from '../../api/account.js';
import { useStore } from '../state/store.js';

export function useAccount(): void {
  const setAccount = useStore((state) => state.setAccount);
  const setAccountSnapshot = useStore((state) => state.setAccountSnapshot);

  useEffect(() => {
    let mounted = true;

    const updateNetwork = (online: boolean) => {
      setAccount({ network: online ? 'online' : 'offline' });
    };

    const handleOnline = () => updateNetwork(true);
    const handleOffline = () => updateNetwork(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      updateNetwork(navigator.onLine);
    }

    const sync = async () => {
      setAccount({ status: 'loading', error: null });
      try {
        const snapshot = await getAccountSnapshot();
        if (!mounted) return;
        setAccountSnapshot(snapshot);
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
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, [setAccount, setAccountSnapshot]);
}
