import type { CustomTheme } from '../../../../shared/types/settings.js';
import type { ThemeId } from '@features/themes/model.js';
import { generateThemeTokens, THEME_TOKEN_KEYS } from './theme-generator.js';

export function applyTheme(theme: ThemeId, customTheme: CustomTheme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  // Sync cache for instant theme restore on panel reload (avoids FOUC)
  try { sessionStorage.setItem('trail-theme-cache', theme); } catch { /* quota / security */ }
  const hasVisualContent = (customTheme?.dots?.length ?? 0) > 0 || (customTheme?.customColors?.length ?? 0) > 0;
  if (!customTheme?.enabled || !hasVisualContent) {
    for (const key of THEME_TOKEN_KEYS) {
      root.style.removeProperty(key);
    }
    return;
  }
  const tokens = generateThemeTokens(customTheme, theme);
  for (const key of THEME_TOKEN_KEYS) {
    const value = tokens[key];
    if (value) {
      root.style.setProperty(key, value);
    } else {
      root.style.removeProperty(key);
    }
  }
}
