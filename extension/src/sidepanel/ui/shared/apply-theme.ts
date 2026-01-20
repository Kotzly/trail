import type { CustomTheme } from '../../../shared/types/settings.js';
import type { ThemeId } from './themes.js';
import { generateThemeTokens, THEME_TOKEN_KEYS } from './theme-generator.js';

export function applyTheme(theme: ThemeId, customTheme: CustomTheme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  if (!customTheme?.enabled) {
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
