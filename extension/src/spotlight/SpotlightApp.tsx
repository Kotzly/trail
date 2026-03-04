import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchSpotlightData } from './rpc.js';
import { SpotlightOverlay } from './SpotlightOverlay.js';
import type { SpotlightData } from './types.js';

type SpotlightAppProps = {
  onRegisterToggle: (toggle: () => void) => void;
};

export function SpotlightApp({ onRegisterToggle }: SpotlightAppProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<SpotlightData | null>(null);
  const [loading, setLoading] = useState(false);
  const isOpenRef = useRef(false);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      isOpenRef.current = next;
      return next;
    });
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    isOpenRef.current = false;
  }, []);

  // Register the toggle function for external callers
  useEffect(() => {
    onRegisterToggle(toggle);
  }, [onRegisterToggle, toggle]);

  // Fetch data when opening
  useEffect(() => {
    if (!isOpen) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchSpotlightData()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error('Failed to fetch spotlight data:', error);
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <SpotlightOverlay
      data={data}
      loading={loading}
      onClose={close}
    />
  );
}
