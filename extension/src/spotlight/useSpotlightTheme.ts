import { useEffect, useRef } from 'react';
import { getSettings } from './rpc.js';
import { settingsItem } from '@shared/config/storage-items.js';
import type { ThemeId } from '@shared/types/theme.js';

/**
 * Resolves a ThemeId ('light' | 'dark' | 'system') to an effective
 * 'light' or 'dark' value suitable for the `data-theme` attribute.
 */
function resolveEffective(themeId: ThemeId): 'light' | 'dark' {
  if (themeId === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return themeId;
}

/**
 * Synchronizes the Spotlight shadow host's `data-theme` attribute with
 * Trail's user-configured theme setting.
 *
 * On mount it immediately applies the OS theme (matching previous
 * `@media (prefers-color-scheme)` behaviour), then fetches the actual
 * setting and corrects if needed. It also watches for live changes
 * via storage and OS media-query events.
 */
export function useSpotlightTheme(
  containerRef: React.RefObject<HTMLElement | null>,
) {
  const themeIdRef = useRef<ThemeId>('system');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const host = (el.getRootNode() as ShadowRoot).host as HTMLElement;

    const apply = () => {
      host.setAttribute('data-theme', resolveEffective(themeIdRef.current));
    };

    // Immediately set based on OS preference (avoids flash before settings load)
    apply();

    // Fetch Trail's actual theme setting
    getSettings()
      .then((s) => {
        themeIdRef.current = s.theme;
        apply();
      })
      .catch(() => {
        // Settings unavailable — keep OS-based default
      });

    // Live-sync when user changes theme in Trail's settings panel
    const unwatch = settingsItem.watch((next) => {
      if (next?.theme) {
        themeIdRef.current = next.theme;
        apply();
      }
    });

    // Re-resolve when OS theme changes (relevant when themeId = 'system')
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onMediaChange = () => {
      if (themeIdRef.current === 'system') apply();
    };
    mql.addEventListener('change', onMediaChange);

    return () => {
      unwatch();
      mql.removeEventListener('change', onMediaChange);
    };
  }, [containerRef]);
}
