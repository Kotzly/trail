export type Theme = {
    id: ThemeId;
    label: string;
    icon: string;
};


export const THEMES: Record<ThemeId, Theme> = {
    'light': {
        id: 'light',
        label: 'Light',
        icon: '☀️',
    },
    'dark': {
        id: 'dark',
        label: 'Dark',
        icon: '🌙',
    },
    'system': {
        id: 'system',
        label: 'System',
        icon: '💻',
    }
};
  
export const DEFAULT_THEME: ThemeId = 'system';

export function getThemes(): Theme[] {
    return Object.values(THEMES);
}


export const THEME_IDS = {
    LIGHT: 'light',
    DARK: 'dark',
    SYSTEM: 'system'
  } as const;
  
export type ThemeId = typeof THEME_IDS[keyof typeof THEME_IDS];