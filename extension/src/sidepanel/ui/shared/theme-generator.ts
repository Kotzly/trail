import type { CustomTheme, ThemeDot, ThemeHarmony } from '../../../shared/types/settings.js';
import type { ThemeId } from './themes.js';

type HslColor = { h: number; s: number; l: number };
type RgbColor = { r: number; g: number; b: number };
type RgbaColor = { r: number; g: number; b: number; a: number };

const HARMONY_ORDER: Array<{ type: ThemeHarmony; angles: number[] }> = [
  { type: 'complementary', angles: [180] },
  { type: 'singleAnalogous', angles: [310] },
  { type: 'splitComplementary', angles: [150, 210] },
  { type: 'analogous', angles: [50, 310] },
  { type: 'triadic', angles: [120, 240] },
  { type: 'floating', angles: [] },
];

const PICKER_BASE_SIZE = 380;
const PICKER_PADDING = 30;
const PICKER_DOT_HALF_SIZE = 29;
const PICKER_RECT_SIZE = PICKER_BASE_SIZE + PICKER_PADDING * 2;
const PICKER_CENTER = PICKER_RECT_SIZE / 2;
const PICKER_RADIUS = (PICKER_RECT_SIZE - PICKER_PADDING) / 2;

export const THEME_TOKEN_KEYS = [
  '--md-surface',
  '--md-surface-container',
  '--md-surface-container-high',
  '--md-surface-container-low',
  '--md-surface-variant',
  '--md-on-surface',
  '--md-on-surface-variant',
  '--md-outline',
  '--md-outline-variant',
  '--md-primary',
  '--md-on-primary',
  '--md-primary-container',
  '--md-on-primary-container',
  '--md-primary-rgb',
  '--md-error',
  '--md-error-rgb',
  '--md-elev-1',
  '--md-elev-2',
  '--md-elev-3',
  '--md-glass',
  '--md-glass-strong',
  '--md-glass-border',
  '--md-glass-inset',
  '--md-glass-ink',
  '--md-on-primary-soft',
  '--md-overlay',
  '--scrollbar-thumb',
  '--scrollbar-thumb-hover',
  '--graph-node-closed-bg',
  '--graph-node-closed-border',
  '--graph-node-closed-title',
  '--graph-node-closed-url',
  '--graph-node-active-bg',
  '--graph-node-active-border',
  '--graph-node-active-title',
  '--graph-node-active-url',
  '--trail-app-bg-color',
  '--trail-app-bg-image',
  '--trail-grain-opacity',
  '--trail-grid-dot',
] as const;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const clamp01 = (value: number) => clamp(value, 0, 1);

const OPACITY_MIN = 0.35;
const OPACITY_MAX = 0.9;
const CUSTOM_COLOR_LIMIT = 4;

const toRgb = (value: number) => Math.round(clamp(value, 0, 255));

const rgbToHex = ({ r, g, b }: RgbColor) =>
  `#${toRgb(r).toString(16).padStart(2, '0')}${toRgb(g)
    .toString(16)
    .padStart(2, '0')}${toRgb(b).toString(16).padStart(2, '0')}`;

const hexToRgb = (value: string): RgbColor => {
  const normalized = value.replace('#', '').trim();
  if (normalized.length === 3) {
    const rChar = normalized[0] ?? '0';
    const gChar = normalized[1] ?? '0';
    const bChar = normalized[2] ?? '0';
    const r = parseInt(rChar + rChar, 16);
    const g = parseInt(gChar + gChar, 16);
    const b = parseInt(bChar + bChar, 16);
    return { r, g, b };
  }
  if (normalized.length >= 6) {
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return { r, g, b };
  }
  return { r: 0, g: 0, b: 0 };
};

const hexToRgba = (value: string): RgbaColor | null => {
  const normalized = value.replace('#', '').trim();
  if (normalized.length === 3 || normalized.length === 4) {
    const rChar = normalized[0] ?? '0';
    const gChar = normalized[1] ?? '0';
    const bChar = normalized[2] ?? '0';
    const aChar = normalized[3];
    const r = parseInt(rChar + rChar, 16);
    const g = parseInt(gChar + gChar, 16);
    const b = parseInt(bChar + bChar, 16);
    const a = aChar ? parseInt(aChar + aChar, 16) / 255 : 1;
    return { r, g, b, a };
  }
  if (normalized.length === 6 || normalized.length === 8) {
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    const a = normalized.length === 8 ? parseInt(normalized.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  return null;
};

const rgbToHsl = ({ r, g, b }: RgbColor): HslColor => {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2;
    } else {
      h = (rNorm - gNorm) / delta + 4;
    }
  }
  h = Math.round(((h * 60) + 360) % 360);
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
};

const hslToRgb = ({ h, s, l }: HslColor): RgbColor => {
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const hPrime = h / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hPrime >= 0 && hPrime < 1) {
    r = c;
    g = x;
    b = 0;
  } else if (hPrime >= 1 && hPrime < 2) {
    r = x;
    g = c;
    b = 0;
  } else if (hPrime >= 2 && hPrime < 3) {
    r = 0;
    g = c;
    b = x;
  } else if (hPrime >= 3 && hPrime < 4) {
    r = 0;
    g = x;
    b = c;
  } else if (hPrime >= 4 && hPrime < 5) {
    r = x;
    g = 0;
    b = c;
  } else if (hPrime >= 5 && hPrime < 6) {
    r = c;
    g = 0;
    b = x;
  }
  const m = light - c / 2;
  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
  };
};

const rgbToCssTuple = ({ r, g, b }: RgbColor) => `${toRgb(r)}, ${toRgb(g)}, ${toRgb(b)}`;

const toRgbString = (rgb: RgbColor) => `rgb(${rgbToCssTuple(rgb)})`;

const toRgbaString = (rgb: RgbColor, alpha: number) =>
  `rgba(${rgbToCssTuple(rgb)}, ${clamp(alpha, 0, 1)})`;

const blendColors = (rgb1: RgbColor, rgb2: RgbColor, percentage: number): RgbColor => {
  const p = clamp(percentage / 100, 0, 1);
  return {
    r: Math.round(rgb1.r * p + rgb2.r * (1 - p)),
    g: Math.round(rgb1.g * p + rgb2.g * (1 - p)),
    b: Math.round(rgb1.b * p + rgb2.b * (1 - p)),
  };
};

const toGradientColor = (value: string, alpha: number): string => {
  const parsed = hexToRgba(value);
  if (!parsed) return value;
  const resolvedAlpha = clamp(parsed.a * alpha, 0, 1);
  return toRgbaString({ r: parsed.r, g: parsed.g, b: parsed.b }, resolvedAlpha);
};

const buildZenGradient = (colors: string[], useCustomColors: boolean): string | null => {
  if (colors.length < 2) return null;
  const rotation = -45;
  if (useCustomColors || colors.length > 3) {
    const stops = colors
      .map((color, index) => {
        const position = (index / (colors.length - 1)) * 100;
        return `${color} ${position}%`;
      })
      .join(', ');
    return `linear-gradient(${rotation}deg, ${stops})`;
  }
  if (colors.length === 2) {
    return [
      `linear-gradient(${rotation}deg, ${colors[1]} 0%, transparent 100%)`,
      `linear-gradient(${rotation + 180}deg, ${colors[0]} 0%, transparent 100%)`,
    ].join(', ');
  }
  if (colors.length === 3) {
    return [
      `linear-gradient(-5deg, ${colors[2]} 10%, transparent 80%)`,
      `radial-gradient(circle at 95% 0%, ${colors[1]} 0%, transparent 75%)`,
      `radial-gradient(circle at 0% 0%, ${colors[0]} 10%, transparent 70%)`,
    ].join(', ');
  }
  return null;
};

const normalizeCustomStops = (customColors: string[] | undefined | null): string[] =>
  (customColors ?? [])
    .map((color) => color.trim())
    .filter((color) => color.length > 0)
    .slice(0, CUSTOM_COLOR_LIMIT);

const parsePaletteColor = (value: string): RgbaColor => {
  const rgba = hexToRgba(value);
  if (rgba) return rgba;
  const rgb = hexToRgb(value);
  return { ...rgb, a: 1 };
};

const resolvePaletteStops = (
  custom: CustomTheme,
): { stops: string[]; useCustomColors: boolean } => {
  const customStops = normalizeCustomStops(custom.customColors);
  if (customStops.length > 0) {
    return { stops: customStops, useCustomColors: true };
  }
  return { stops: getDotColors(custom.dots, custom.lightness), useCustomColors: false };
};

const blendPaletteColor = (
  color: RgbaColor,
  baseSurfaceRgb: RgbColor,
  opacity: number,
): RgbColor => {
  const alpha = clamp((color.a ?? 1) * opacity, 0, 1);
  return blendColors({ r: color.r, g: color.g, b: color.b }, baseSurfaceRgb, alpha * 100);
};

const getAutoAccentRgb = (custom: CustomTheme, scheme: ThemeId): RgbColor => {
  const { stops } = resolvePaletteStops(custom);
  const palette = stops.map(parsePaletteColor);
  const paletteRgb = palette.map((color) => ({ r: color.r, g: color.g, b: color.b }));
  const mode = getResolvedScheme(scheme);
  const isDark = mode === 'dark';
  const baseSurfaceRgb = isDark ? { r: 23, g: 23, b: 26 } : { r: 240, g: 240, b: 244 };
  const opacity = clamp(custom.opacity, OPACITY_MIN, OPACITY_MAX);
  const blendedRgb = palette.map((color) => blendPaletteColor(color, baseSurfaceRgb, opacity));
  return blendedRgb[0] ?? paletteRgb[0] ?? baseSurfaceRgb;
};

export const getAutoAccentColor = (custom: CustomTheme, scheme: ThemeId): string =>
  rgbToHex(getAutoAccentRgb(custom, scheme));

const getLuminance = ({ r, g, b }: RgbColor) => {
  const toLinear = (value: number) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  const rLin = toLinear(r);
  const gLin = toLinear(g);
  const bLin = toLinear(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
};

const getContrastText = (background: RgbColor) => {
  const luminance = getLuminance(background);
  return luminance > 0.45 ? { r: 16, g: 18, b: 24 } : { r: 255, g: 255, b: 255 };
};

export function clampDotPosition(dot: ThemeDot): ThemeDot {
  return {
    x: clamp(dot.x, 0, 1),
    y: clamp(dot.y, 0, 1),
    ...(dot.type ? { type: dot.type } : {}),
  };
}

export type HarmonyAction = 'add' | 'remove' | 'update';

const getHarmonyByType = (type?: ThemeHarmony) =>
  HARMONY_ORDER.find((harmony) => harmony.type === type);

const getHarmonyForAction = (
  numDots: number,
  action: HarmonyAction,
  useHarmony?: ThemeHarmony
) => {
  if (useHarmony) {
    const selected = getHarmonyByType(useHarmony);
    if (selected) {
      if (action === 'remove') {
        if (numDots <= 0) {
          return getHarmonyByType('floating');
        }
        return HARMONY_ORDER.find((harmony) => harmony.angles.length === selected.angles.length - 1);
      }
      if (action === 'add') {
        return HARMONY_ORDER.find((harmony) => harmony.angles.length === selected.angles.length + 1);
      }
      return selected;
    }
  }

  if (action === 'remove') {
    let harmony = HARMONY_ORDER.find((item) => item.angles.length === numDots);
    if (harmony?.type === 'analogous' && numDots === 1) {
      harmony = getHarmonyByType('singleAnalogous');
    }
    return harmony;
  }

  if (action === 'add') {
    return HARMONY_ORDER.find((item) => item.angles.length + 1 === numDots);
  }

  if (action === 'update') {
    return HARMONY_ORDER.find((item) => item.angles.length + 1 === numDots);
  }

  return null;
};

export function calculateCompliments(
  dots: ThemeDot[],
  action: HarmonyAction,
  useHarmony?: ThemeHarmony
): { dots: ThemeDot[]; harmony: ThemeHarmony } {
  if (dots.length === 0) {
    return { dots: [], harmony: useHarmony ?? 'floating' };
  }

  const numDots = dots.length + (action === 'add' ? 1 : action === 'remove' ? -1 : 0);
  const harmony = getHarmonyForAction(numDots, action, useHarmony) ?? getHarmonyByType('floating');
  const angles = harmony?.angles ?? [];
  const resolvedHarmony = harmony?.type ?? 'floating';

  if (angles.length === 0) {
    return { dots: dots.map(clampDotPosition), harmony: resolvedHarmony };
  }

  const primary = clampDotPosition(dots[0] ?? { x: 0.5, y: 0.5 });
  const center = { x: 0.5, y: 0.5 };
  const dx = primary.x - center.x;
  const dy = primary.y - center.y;
  const distance = Math.min(Math.sqrt(dx * dx + dy * dy), 0.5);
  const baseAngle = (Math.atan2(dy, dx) * 180) / Math.PI;

  const nextDots: ThemeDot[] = [primary];
  angles.forEach((offset) => {
    const angle = ((baseAngle + offset) * Math.PI) / 180;
    const nextDot: ThemeDot = {
      x: clamp(center.x + distance * Math.cos(angle), 0, 1),
      y: clamp(center.y + distance * Math.sin(angle), 0, 1),
    };
    if (primary.type) {
      nextDot.type = primary.type;
    }
    nextDots.push(nextDot);
  });

  return { dots: nextDots, harmony: resolvedHarmony };
}

const getDotPolar = (dot: ThemeDot) => {
  const safeDot = clampDotPosition(dot);
  const adjustedX = safeDot.x * PICKER_BASE_SIZE + PICKER_DOT_HALF_SIZE;
  const adjustedY = safeDot.y * PICKER_BASE_SIZE + PICKER_DOT_HALF_SIZE;
  const dx = adjustedX - PICKER_CENTER;
  const dy = adjustedY - PICKER_CENTER;
  const distance = Math.sqrt(dx * dx + dy * dy);
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle < 0) angle += 360;
  const normalizedDistance = 1 - Math.min(distance / PICKER_RADIUS, 1);
  return { angle, normalizedDistance, type: safeDot.type };
};

export const getDotLightness = (dot: ThemeDot) => {
  const { normalizedDistance } = getDotPolar(dot);
  return Math.round((1 - normalizedDistance) * 100);
};

export function getColorFromPosition(
  dot: ThemeDot,
  lightness: number
): { rgb: RgbColor; hex: string } {
  const { angle, normalizedDistance, type } = getDotPolar(dot);
  const baseLightness = Math.round((1 - normalizedDistance) * 100);
  let saturation = 90 + (1 - normalizedDistance) * 10;
  let resolvedLightness = baseLightness;
  if (type === 'explicit-lightness') {
    saturation = normalizedDistance * 100;
    resolvedLightness = clamp(lightness, 0, 100);
  } else if (type === 'explicit-black-white') {
    saturation = 0;
    resolvedLightness = baseLightness;
  }
  const rgb = hslToRgb({ h: angle, s: saturation, l: resolvedLightness });
  return { rgb, hex: rgbToHex(rgb) };
}

export function getDotColors(dots: ThemeDot[], lightness: number): string[] {
  return dots.map((dot) => getColorFromPosition(dot, lightness).hex);
}

const getResolvedScheme = (scheme: ThemeId): 'light' | 'dark' => {
  if (scheme === 'light') return 'light';
  if (scheme === 'dark') return 'dark';
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const toHslString = (color: HslColor) => rgbToHex(hslToRgb(color));

export function generateThemeTokens(custom: CustomTheme, scheme: ThemeId): Record<string, string> {
  const { stops: paletteStops, useCustomColors } = resolvePaletteStops(custom);
  const palette = paletteStops.map(parsePaletteColor);
  const fallbackRgb = { r: 59, g: 59, b: 64 };
  const mode = getResolvedScheme(scheme);
  const isDark = mode === 'dark';
  const baseSurfaceRgb = isDark ? { r: 23, g: 23, b: 26 } : { r: 240, g: 240, b: 244 };
  const opacity = clamp(custom.opacity, OPACITY_MIN, OPACITY_MAX);
  const blendedRgb = palette.map((color) => blendPaletteColor(color, baseSurfaceRgb, opacity));
  const accentOverride = custom.accentColor ? hexToRgb(custom.accentColor) : null;
  const accentRgb = accentOverride ?? getAutoAccentRgb(custom, scheme);
  const averageSource = blendedRgb.length > 0 ? blendedRgb : [fallbackRgb];
  const averageRgb = averageSource.reduce(
    (acc, color) => ({
      r: acc.r + color.r,
      g: acc.g + color.g,
      b: acc.b + color.b,
    }),
    { r: 0, g: 0, b: 0 }
  );
  const averaged = {
    r: averageRgb.r / averageSource.length,
    g: averageRgb.g / averageSource.length,
    b: averageRgb.b / averageSource.length,
  };
  const gradientStops = useCustomColors
    ? paletteStops.map((color) => toGradientColor(color, opacity))
    : blendedRgb.map(toRgbString);
  const gradientImage = buildZenGradient(gradientStops, useCustomColors);
  const gradientBase = blendedRgb.length ? rgbToHex(averaged) : null;
  const neutralHsl = rgbToHsl(averaged);
  const accentHsl = rgbToHsl(accentRgb);

  const neutralHue = neutralHsl.h;
  const neutralSat = clamp(neutralHsl.s * 0.35, 0, 28);
  const neutralIsGray = neutralSat < 4;
  const surfaceLevels = isDark
    ? {
        surface: 12,
        container: 16,
        containerHigh: 20,
        containerLow: 14,
        variant: 26,
        onSurface: 90,
        onSurfaceVariant: 70,
        outline: 55,
        outlineVariant: 35,
      }
    : {
        surface: 97,
        container: 94,
        containerHigh: 90,
        containerLow: 99,
        variant: 88,
        onSurface: 12,
        onSurfaceVariant: 36,
        outline: 55,
        outlineVariant: 80,
      };

  const surface = toHslString({ h: neutralHue, s: neutralSat, l: surfaceLevels.surface });
  const surfaceContainer = toHslString({
    h: neutralHue,
    s: neutralSat,
    l: surfaceLevels.container,
  });
  const surfaceContainerHigh = toHslString({
    h: neutralHue,
    s: neutralSat,
    l: surfaceLevels.containerHigh,
  });
  const surfaceContainerLow = toHslString({
    h: neutralHue,
    s: neutralSat,
    l: surfaceLevels.containerLow,
  });
  const surfaceVariant = toHslString({
    h: neutralHue,
    s: neutralIsGray ? 0 : Math.min(neutralSat + 6, 22),
    l: surfaceLevels.variant,
  });
  const onSurface = toHslString({
    h: neutralHue,
    s: neutralIsGray ? 0 : Math.min(neutralSat + 2, 8),
    l: surfaceLevels.onSurface,
  });
  const onSurfaceVariant = toHslString({
    h: neutralHue,
    s: neutralIsGray ? 0 : Math.min(neutralSat + 4, 12),
    l: surfaceLevels.onSurfaceVariant,
  });
  const outline = toHslString({
    h: neutralHue,
    s: neutralIsGray ? 0 : Math.min(neutralSat + 2, 10),
    l: surfaceLevels.outline,
  });
  const outlineVariant = toHslString({
    h: neutralHue,
    s: neutralIsGray ? 0 : Math.min(neutralSat + 2, 8),
    l: surfaceLevels.outlineVariant,
  });

  const shouldBoostAccent = !accentOverride;
  const primarySat =
    shouldBoostAccent && accentHsl.s >= 8 ? Math.max(accentHsl.s, 34) : accentHsl.s;
  const containerSat =
    shouldBoostAccent && accentHsl.s >= 8 ? Math.min(Math.max(accentHsl.s, 24), 50) : accentHsl.s;
  const primary = toHslString({
    h: accentHsl.h,
    s: primarySat,
    l: isDark ? 65 : 35,
  });
  const primaryContainer = toHslString({
    h: accentHsl.h,
    s: containerSat,
    l: isDark ? 26 : 90,
  });
  const primaryRgbResolved = hexToRgb(primary);
  const primaryContainerRgb = hexToRgb(primaryContainer);
  const onPrimary = rgbToHex(getContrastText(primaryRgbResolved));
  const onPrimaryContainer = rgbToHex(getContrastText(primaryContainerRgb));

  const error = toHslString({ h: 2, s: 70, l: isDark ? 65 : 45 });
  const errorRgb = hexToRgb(error);

  const surfaceRgb = hexToRgb(surface);
  const surfaceContainerRgb = hexToRgb(surfaceContainer);
  const onSurfaceRgb = hexToRgb(onSurface);

  const appBackgroundColor = gradientBase ?? surface;
  const appBackgroundImage = gradientImage ?? 'none';
  const backgroundRgb = appBackgroundColor.startsWith('#') ? hexToRgb(appBackgroundColor) : surfaceRgb;
  const backgroundLuminance = getLuminance(backgroundRgb);
  const gridContrastRgb = getContrastText(backgroundRgb);
  const gridAlpha = backgroundLuminance > 0.6 ? 0.18 : backgroundLuminance < 0.35 ? 0.28 : 0.22;
  const gridDot = toRgbaString(gridContrastRgb, gridAlpha);
  const glassInkRgb = getContrastText(surfaceContainerRgb);
  const glassInk = rgbToHex(glassInkRgb);
  const primarySoftRgb = blendColors(primaryRgbResolved, backgroundRgb, 45);
  const primarySoftInk = rgbToHex(getContrastText(primarySoftRgb));
  const overlayAlpha =
    backgroundLuminance > 0.6 ? 0.12 : backgroundLuminance < 0.35 ? 0.45 : 0.28;
  const overlay = `rgba(8, 10, 14, ${overlayAlpha})`;

  const mdElev1 = isDark
    ? '0 1px 2px rgba(0, 0, 0, 0.55), 0 10px 24px -16px rgba(0, 0, 0, 0.9)'
    : '0 2px 6px rgba(20, 24, 40, 0.08)';
  const mdElev2 = isDark
    ? '0 2px 3px rgba(0, 0, 0, 0.55), 0 18px 40px -22px rgba(0, 0, 0, 0.95)'
    : '0 8px 18px rgba(20, 24, 40, 0.12)';
  const mdElev3 = isDark
    ? '0 3px 5px rgba(0, 0, 0, 0.55), 0 28px 60px -30px rgba(0, 0, 0, 0.95)'
    : '0 14px 30px rgba(20, 24, 40, 0.18)';

  const closedBg = surfaceContainer;
  const closedBorder = outlineVariant;
  const closedTitle = onSurfaceVariant;
  const closedUrl = onSurfaceVariant;

  const activeBg = primaryContainer;
  const activeBorder = primary;
  const activeTitle = onPrimaryContainer;
  const activeUrl = primary;

  return {
    '--md-surface': surface,
    '--md-surface-container': surfaceContainer,
    '--md-surface-container-high': surfaceContainerHigh,
    '--md-surface-container-low': surfaceContainerLow,
    '--md-surface-variant': surfaceVariant,
    '--md-on-surface': onSurface,
    '--md-on-surface-variant': onSurfaceVariant,
    '--md-outline': outline,
    '--md-outline-variant': outlineVariant,
    '--md-primary': primary,
    '--md-on-primary': onPrimary,
    '--md-primary-container': primaryContainer,
    '--md-on-primary-container': onPrimaryContainer,
    '--md-primary-rgb': rgbToCssTuple(primaryRgbResolved),
    '--md-error': error,
    '--md-error-rgb': rgbToCssTuple(errorRgb),
    '--md-elev-1': mdElev1,
    '--md-elev-2': mdElev2,
    '--md-elev-3': mdElev3,
    '--md-glass-ink': glassInk,
    '--md-on-primary-soft': primarySoftInk,
    '--md-overlay': overlay,
    '--scrollbar-thumb': `rgba(${rgbToCssTuple(primaryRgbResolved)}, ${isDark ? 0.2 : 0.24})`,
    '--scrollbar-thumb-hover': `rgba(${rgbToCssTuple(primaryRgbResolved)}, ${
      isDark ? 0.36 : 0.4
    })`,
    '--graph-node-closed-bg': closedBg,
    '--graph-node-closed-border': closedBorder,
    '--graph-node-closed-title': closedTitle,
    '--graph-node-closed-url': closedUrl,
    '--graph-node-active-bg': activeBg,
    '--graph-node-active-border': activeBorder,
    '--graph-node-active-title': activeTitle,
    '--graph-node-active-url': activeUrl,
    '--trail-app-bg-color': appBackgroundColor,
    '--trail-app-bg-image': appBackgroundImage,
    '--trail-grain-opacity': String(clamp(custom.texture ?? 0, 0, 1)),
    '--trail-grid-dot': gridDot,
  };
}

export function resolveHarmonyForCount(count: number, current: ThemeHarmony): ThemeHarmony {
  if (count <= 0) return 'floating';
  const normalized = clamp(count, 1, 3);
  const valid: ThemeHarmony[] =
    normalized === 1
      ? ['floating']
      : normalized === 2
      ? ['complementary', 'singleAnalogous']
      : ['splitComplementary', 'analogous', 'triadic'];
  return valid.includes(current) ? current : valid[0] ?? 'floating';
}
