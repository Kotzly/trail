import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchSpotlightData } from './rpc.js';
import { SpotlightOverlay } from './SpotlightOverlay.js';
import { generateThemeTokens } from '@entrypoints/sidepanel/ui/shared/theme-generator.js';
import type { SpotlightData } from './types.js';

type SpotlightAppProps = {
  onRegisterToggle: (toggle: () => void) => void;
};

export function SpotlightApp({ onRegisterToggle }: SpotlightAppProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);
  const [data, setData] = useState<SpotlightData | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    onRegisterToggle(toggle);
  }, [onRegisterToggle, toggle]);

  // Track first open — never unmount after that
  useEffect(() => {
    if (isOpen) setHasBeenOpened(true);
  }, [isOpen]);

  // Fetch data when opening (keep data across close/reopen)
  useEffect(() => {
    if (!isOpen) return;

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
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen]);

  // Compute theme CSS tokens from settings
  const themeTokens = useMemo(() => {
    const settings = data?.settings;
    if (!settings) return null;
    const { theme, customTheme } = settings;
    const hasVisualContent =
      (customTheme?.dots?.length ?? 0) > 0 || (customTheme?.customColors?.length ?? 0) > 0;
    if (!customTheme?.enabled || !hasVisualContent) return null;
    return generateThemeTokens(customTheme, theme);
  }, [data?.settings]);

  // Don't render anything until first open
  if (!hasBeenOpened) return null;

  return (
    <SpotlightOverlay
      isOpen={isOpen}
      data={data}
      loading={loading}
      onClose={close}
      themeTokens={themeTokens}
    />
  );
}
