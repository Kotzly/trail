export const THEME_IDS = {
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
} as const;

export type ThemeId = typeof THEME_IDS[keyof typeof THEME_IDS];

export const DEFAULT_THEME: ThemeId = THEME_IDS.SYSTEM;
