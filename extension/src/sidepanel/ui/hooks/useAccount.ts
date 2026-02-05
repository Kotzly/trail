import { useEffect } from 'react';
import { getAccountSnapshot, normalizeAccountError } from '../../api/account.js';
import { useStore } from '../state/store.js';


export function useAccount(): void {
  // todo: fix this shit
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
      if (window) {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, [setAccount, setAccountSnapshot]);
}
