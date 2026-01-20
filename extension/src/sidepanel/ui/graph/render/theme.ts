import { Color } from 'pixi.js';

export type GraphTheme = {
  surface: number;
  surfaceContainer: number;
  surfaceContainerHigh: number;
  outline: number;
  primary: number;
  primaryContainer: number;
  onSurface: number;
  onSurfaceVariant: number;
  onPrimary: number;
  active: {
    background: number;
    border: number;
    title: number;
    url: number;
  };
  closed: {
    background: number;
    border: number;
    title: number;
    url: number;
  };
  connection: {
    base: number;
    path: number;
  };
};

type ThemeSource = {
  host: HTMLElement;
};

const DEFAULT_THEME: GraphTheme = {
  surface: 0x0f1014,
  surfaceContainer: 0x1c1f27,
  surfaceContainerHigh: 0x252a35,
  outline: 0x3a3f4b,
  primary: 0x3b3b40,
  primaryContainer: 0xe6e7ec,
  onSurface: 0xe8e8ee,
  onSurfaceVariant: 0xb5b7c0,
  onPrimary: 0xffffff,
  active: {
    background: 0x2b2d33,
    border: 0xd2d3d7,
    title: 0xf2f3f6,
    url: 0xc9cbd2,
  },
  closed: {
    background: 0x12151d,
    border: 0x333848,
    title: 0x9fa3ad,
    url: 0x8a8f99,
  },
  connection: {
    base: 0x444444,
    path: 0xffffff,
  },
};

const parseColor = (value: string | null | undefined, fallback: number): number => {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    return Color.shared.setValue(trimmed).toNumber();
  } catch {
    return fallback;
  }
};

export function readGraphTheme(source: ThemeSource): GraphTheme {
  const style = getComputedStyle(source.host);
  const theme: GraphTheme = {
    surface: parseColor(style.getPropertyValue('--md-surface'), DEFAULT_THEME.surface),
    surfaceContainer: parseColor(
      style.getPropertyValue('--md-surface-container'),
      DEFAULT_THEME.surfaceContainer
    ),
    surfaceContainerHigh: parseColor(
      style.getPropertyValue('--md-surface-container-high'),
      DEFAULT_THEME.surfaceContainerHigh
    ),
    outline: parseColor(style.getPropertyValue('--md-outline-variant'), DEFAULT_THEME.outline),
    primary: parseColor(style.getPropertyValue('--md-primary'), DEFAULT_THEME.primary),
    primaryContainer: parseColor(
      style.getPropertyValue('--md-primary-container'),
      DEFAULT_THEME.primaryContainer
    ),
    onSurface: parseColor(style.getPropertyValue('--md-on-surface'), DEFAULT_THEME.onSurface),
    onSurfaceVariant: parseColor(
      style.getPropertyValue('--md-on-surface-variant'),
      DEFAULT_THEME.onSurfaceVariant
    ),
    onPrimary: parseColor(style.getPropertyValue('--md-on-primary'), DEFAULT_THEME.onPrimary),
    active: {
      background: parseColor(
        style.getPropertyValue('--graph-node-active-bg'),
        DEFAULT_THEME.active.background
      ),
      border: parseColor(
        style.getPropertyValue('--graph-node-active-border'),
        DEFAULT_THEME.active.border
      ),
      title: parseColor(
        style.getPropertyValue('--graph-node-active-title'),
        DEFAULT_THEME.active.title
      ),
      url: parseColor(style.getPropertyValue('--graph-node-active-url'), DEFAULT_THEME.active.url),
    },
    closed: {
      background: parseColor(
        style.getPropertyValue('--graph-node-closed-bg'),
        DEFAULT_THEME.closed.background
      ),
      border: parseColor(
        style.getPropertyValue('--graph-node-closed-border'),
        DEFAULT_THEME.closed.border
      ),
      title: parseColor(
        style.getPropertyValue('--graph-node-closed-title'),
        DEFAULT_THEME.closed.title
      ),
      url: parseColor(
        style.getPropertyValue('--graph-node-closed-url'),
        DEFAULT_THEME.closed.url
      ),
    },
    connection: {
      base: parseColor(style.getPropertyValue('--md-outline-variant'), DEFAULT_THEME.connection.base),
      path: parseColor(style.getPropertyValue('--md-on-surface'), DEFAULT_THEME.connection.path),
    },
  };
  return theme;
}
