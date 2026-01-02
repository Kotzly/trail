/**
 * Material Design 3 Theme Configuration
 * Supports: light, dark, system (auto-detect)
 */

export const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

export const THEMES = {
  [THEME.LIGHT]: {
    id: THEME.LIGHT,
    label: 'Light',
    icon: '☀️'
  },
  [THEME.DARK]: {
    id: THEME.DARK,
    label: 'Dark',
    icon: '🌙'
  },
  [THEME.SYSTEM]: {
    id: THEME.SYSTEM,
    label: 'System',
    icon: '💻'
  }
};

export const DEFAULT_THEME = THEME.SYSTEM;

export function getThemes() {
  return Object.values(THEMES);
}

export function isValidTheme(themeId) {
  return themeId in THEMES;
}
