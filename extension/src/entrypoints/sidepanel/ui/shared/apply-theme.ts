import type { CustomTheme } from '@shared/types/settings.js';
import type { ThemeId } from '@features/themes/model.js';
import { generateThemeTokens, generateBaseTokens, THEME_TOKEN_KEYS } from './theme-generator.js';
import { themeCacheItem } from '@shared/config/storage-items.js';

/**
 * Apply theme CSS tokens to an arbitrary element.
 *
 * Does NOT set `data-theme` or write to storage — only writes/clears
 * THEME_TOKEN_KEYS as inline styles on `target`.
 *
 * @param preserveDefaults (default true) — when true and custom theme is
 *   disabled, removes inline tokens so tokens.css cascade takes over
 *   (sidepanel root). When false, generates and applies base tokens
 *   because the target has no tokens.css (Spotlight Shadow DOM host).
 */
export function applyThemeTokens(
  target: HTMLElement,
  theme: ThemeId,
  customTheme: CustomTheme,
  opts?: { preserveDefaults?: boolean },
): void {
  const preserveDefaults = opts?.preserveDefaults ?? true;
  const effective: 'light' | 'dark' = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  const hasVisualContent = (customTheme?.dots?.length ?? 0) > 0 || (customTheme?.customColors?.length ?? 0) > 0;
  if (!customTheme?.enabled || !hasVisualContent) {
    if (preserveDefaults) {
      // Sidepanel: clear inline tokens, rely on tokens.css
      for (const key of THEME_TOKEN_KEYS) {
        target.style.removeProperty(key);
      }
    } else {
      // Spotlight: apply base tokens since no tokens.css available
      const baseTokens = generateBaseTokens(effective);
      for (const key of THEME_TOKEN_KEYS) {
        const value = baseTokens[key as keyof typeof baseTokens];
        if (value) {
          target.style.setProperty(key, value);
        } else {
          target.style.removeProperty(key);
        }
      }
    }
    return;
  }
  const tokens = generateThemeTokens(customTheme, effective);
  for (const key of THEME_TOKEN_KEYS) {
    const value = tokens[key];
    if (value) {
      target.style.setProperty(key, value);
    } else {
      target.style.removeProperty(key);
    }
  }
}

/**
 * Apply theme to the sidepanel document root.
 * Sets data-theme, writes tokens, and persists to cache.
 */
export function applyTheme(theme: ThemeId, customTheme: CustomTheme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  void themeCacheItem.setValue(theme);
  applyThemeTokens(root, theme, customTheme, { preserveDefaults: true });

  // Persist resolved theme to localStorage for instant access by inline
  // scripts in fullview/sidepanel HTML — prevents white flash on load.
  const effective: 'light' | 'dark' = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  try { localStorage.setItem('trail_theme', effective); } catch { /* quota / sandboxed */ }
}
