import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CustomTheme, ThemeDot, ThemeHarmony } from '../../../../shared/types/settings.js';
import type { ThemeId } from '../../shared/themes.js';
import { Icons } from '../Icon.js';
import {
  calculateCompliments,
  getAutoAccentColor,
  getColorFromPosition,
  getDotLightness,
  resolveHarmonyForCount,
} from '../../shared/theme-generator.js';
import { PRESET_PAGES, type ThemePreset } from './theme-presets.js';
import React from 'react';

type ThemePaletteProps = {
  scheme: ThemeId;
  value: CustomTheme;
  onSchemeChange: (scheme: ThemeId) => void;
  onPreview: (next: CustomTheme) => void;
  onCommit: (next: CustomTheme) => void;
};

const DEFAULT_PRIMARY: ThemeDot = { x: 0.5, y: 0.5 };

const DEFAULT_THEME: CustomTheme = {
  enabled: false,
  dots: [],
  harmony: 'floating',
  lightness: 50,
  opacity: 0.6,
  texture: 0,
  customColors: [],
  accentColor: null,
};

const DOT_TYPES: Array<ThemeDot['type']> = ['explicit-lightness', 'explicit-black-white'];
const CUSTOM_COLOR_LIMIT = 4;

const HARMONY_LABELS: Record<ThemeHarmony, string> = {
  floating: 'Floating',
  complementary: 'Complementary',
  singleAnalogous: 'Analogous',
  splitComplementary: 'Split',
  analogous: 'Analogous',
  triadic: 'Triadic',
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const OPACITY_MIN = 0.35;
const OPACITY_MAX = 0.9;

const LINE_PATH = 'M 51.373 27.395 L 367.037 27.395';
const SINE_PATH =
  'M 51.373 27.395 C 60.14 -8.503 68.906 -8.503 77.671 27.395 C 86.438 63.293 95.205 63.293 103.971 27.395 C 112.738 -8.503 121.504 -8.503 130.271 27.395 C 139.037 63.293 147.803 63.293 156.57 27.395 C 165.335 -8.503 174.101 -8.503 182.868 27.395 C 191.634 63.293 200.4 63.293 209.167 27.395 C 217.933 -8.503 226.7 -8.503 235.467 27.395 C 244.233 63.293 252.999 63.293 261.765 27.395 C 270.531 -8.503 279.297 -8.503 288.064 27.395 C 296.83 63.293 305.596 63.293 314.363 27.395 C 323.13 -8.503 331.896 -8.503 340.662 27.395 M 314.438 27.395 C 323.204 -8.503 331.97 -8.503 340.737 27.395 C 349.503 63.293 358.27 63.293 367.037 27.395';

type WavePoint =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number };

const parseWavePath = (path: string): WavePoint[] => {
  const points: WavePoint[] = [];
  const commands = path.match(/[MCL]\s*[\d\s.\-,]+/g);
  if (!commands) return points;
  commands.forEach((command) => {
    const type = command.charAt(0);
    const coordsStr = command.slice(1).trim();
    const coords = coordsStr.split(/[\s,]+/).map(Number);
    if (type === 'M') {
      points.push({ type: 'M', x: coords[0] ?? 0, y: coords[1] ?? 0 });
      return;
    }
    if (type === 'L') {
      points.push({ type: 'L', x: coords[0] ?? 0, y: coords[1] ?? 0 });
      return;
    }
    if (type === 'C' && coords.length >= 6 && coords.length % 6 === 0) {
      for (let i = 0; i < coords.length; i += 6) {
        points.push({
          type: 'C',
          x1: coords[i] ?? 0,
          y1: coords[i + 1] ?? 0,
          x2: coords[i + 2] ?? 0,
          y2: coords[i + 3] ?? 0,
          x: coords[i + 4] ?? 0,
          y: coords[i + 5] ?? 0,
        });
      }
    }
  });
  return points;
};

const SINE_POINTS = parseWavePath(SINE_PATH);

const interpolateWavePath = (progress: number) => {
  if (SINE_POINTS.length === 0) return progress < 0.5 ? LINE_PATH : SINE_PATH;
  if (progress <= 0.001) return LINE_PATH;
  if (progress >= 0.999) return SINE_PATH;
  const referenceY = 27.3;
  const t = progress;
  let pathData = '';
  SINE_POINTS.forEach((point) => {
    if (point.type === 'M') {
      const y = referenceY + (point.y - referenceY) * t;
      pathData += `M ${point.x} ${y} `;
      return;
    }
    if (point.type === 'L') {
      pathData += `L ${point.x} ${point.y} `;
      return;
    }
    const y1 = referenceY + (point.y1 - referenceY) * t;
    const y2 = referenceY + (point.y2 - referenceY) * t;
    const y = referenceY + (point.y - referenceY) * t;
    pathData += `C ${point.x1} ${y1} ${point.x2} ${y2} ${point.x} ${y} `;
  });
  return pathData.trim();
};

const getLightnessFromDot = (dot: ThemeDot) => getDotLightness(dot);

const shouldSyncLightness = (dot: ThemeDot) => dot.type !== 'explicit-lightness';

const clampToCircle = (x: number, y: number) => {
  const cx = 0.5;
  const cy = 0.5;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= 0.5) {
    return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
  }
  const scale = 0.5 / dist;
  return { x: clamp(cx + dx * scale, 0, 1), y: clamp(cy + dy * scale, 0, 1) };
};

const normalizeHexInput = (value: string, fallback: string) => {
  const trimmed = value.trim();
  const hexMatch = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (hexMatch) {
    const hex = hexMatch[1] ?? '';
    if (hex.length === 3) {
      return `#${hex
        .split('')
        .map((char) => `${char}${char}`)
        .join('')}`;
    }
    if (hex.length === 8) {
      return `#${hex.slice(0, 6)}`;
    }
    return `#${hex}`;
  }
  return fallback;
};

const buildDots = (primary: ThemeDot, harmony: ThemeHarmony) => {
  const result = calculateCompliments([primary], 'update', harmony);
  return result.dots;
};

const normalizeTheme = (theme: CustomTheme | null | undefined): CustomTheme => {
  if (!theme) return { ...DEFAULT_THEME };
  const next = { ...DEFAULT_THEME, ...theme };
  const rawDots = Array.isArray(next.dots) ? next.dots : [];
  next.dots = rawDots
    .map((dot) => {
      const type = DOT_TYPES.includes(dot?.type) ? dot?.type : undefined;
      return {
        x: clamp(dot?.x ?? 0.5, 0, 1),
        y: clamp(dot?.y ?? 0.5, 0, 1),
        ...(type ? { type } : {}),
      };
    })
    .slice(0, 3);
  const rawCustomColors = Array.isArray(next.customColors) ? next.customColors : [];
  next.customColors = rawCustomColors
    .map((color) => (typeof color === 'string' ? color.trim() : ''))
    .filter((color) => color.length > 0)
    .slice(0, CUSTOM_COLOR_LIMIT);
  next.lightness = clamp(
    typeof next.lightness === 'number' ? next.lightness : DEFAULT_THEME.lightness,
    0,
    100
  );
  next.opacity = clamp(
    typeof next.opacity === 'number' ? next.opacity : DEFAULT_THEME.opacity,
    OPACITY_MIN,
    OPACITY_MAX
  );
  next.texture = clamp(
    typeof next.texture === 'number' ? next.texture : DEFAULT_THEME.texture,
    0,
    1
  );
  if (typeof next.accentColor !== 'string' || !/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(next.accentColor)) {
    next.accentColor = null;
  }
  return next;
};

const getPrimaryDot = (theme: CustomTheme): ThemeDot => theme.dots[0] ?? DEFAULT_PRIMARY;

export default function ThemePalette({
  scheme,
  value,
  onSchemeChange,
  onPreview,
  onCommit,
}: ThemePaletteProps) {
  const [draft, setDraft] = useState<CustomTheme>(() => normalizeTheme(value));
  const [pageIndex, setPageIndex] = useState(0);
  const [customColor, setCustomColor] = useState('#484848');
  const [customOpacity, setCustomOpacity] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const gradientRef = useRef<HTMLDivElement | null>(null);
  const dotRefs = useRef<Array<HTMLDivElement | null>>([]);
  const textureRef = useRef<HTMLDivElement | null>(null);
  const textureHandleRef = useRef<HTMLDivElement | null>(null);
  const opacitySliderRef = useRef<HTMLInputElement | null>(null);
  const wavePathRef = useRef<SVGPathElement | null>(null);
  const waveStopMidRef = useRef<SVGStopElement | null>(null);
  const waveStopEndRef = useRef<SVGStopElement | null>(null);
  const draggingRef = useRef(false);
  const dragPointerId = useRef<number | null>(null);
  const texturePointerId = useRef<number | null>(null);
  const recentlyDraggedRef = useRef(false);
  const recentlyDraggedTimer = useRef<number | null>(null);
  const bounceTimerRef = useRef<number | null>(null);
  const draftRef = useRef<CustomTheme>(draft);
  const customColorsCount = draft.customColors?.length ?? 0;
  const customMode = customColorsCount > 0;
  const canAddCustomColor = customColorsCount < CUSTOM_COLOR_LIMIT;

  useEffect(() => {
    const next = normalizeTheme(value);
    setDraft(next);
    draftRef.current = next;
  }, [value]);

  const markRecentlyDragged = useCallback(() => {
    recentlyDraggedRef.current = true;
    if (recentlyDraggedTimer.current !== null) {
      window.clearTimeout(recentlyDraggedTimer.current);
    }
    recentlyDraggedTimer.current = window.setTimeout(() => {
      recentlyDraggedRef.current = false;
      recentlyDraggedTimer.current = null;
    }, 100);
  }, []);

  const updateDotsVisual = useCallback(
    (next: CustomTheme) => {
      next.dots.forEach((dot, index) => {
        const el = dotRefs.current[index];
        if (!el) return;
        const { hex } = getColorFromPosition(dot, next.lightness);
        el.style.left = `${dot.x * 100}%`;
        el.style.top = `${dot.y * 100}%`;
        el.style.setProperty('--zen-theme-picker-dot-color', hex);
      });
    },
    []
  );

  const updateTextureHandle = useCallback((texture: number) => {
    if (!textureHandleRef.current) return;
    const angle = texture * Math.PI * 2 - Math.PI / 2;
    const x = 50 + Math.cos(angle) * 48;
    const y = 50 + Math.sin(angle) * 48;
    const rotation = (angle * 180) / Math.PI + 90;
    textureHandleRef.current.style.left = `${x}%`;
    textureHandleRef.current.style.top = `${y}%`;
    textureHandleRef.current.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
  }, []);

  const updateOpacityWave = useCallback((opacity: number) => {
    const normalized =
      opacity <= OPACITY_MIN
        ? 0
        : opacity >= OPACITY_MAX
          ? 1
          : (opacity - OPACITY_MIN) / (OPACITY_MAX - OPACITY_MIN);
    const path = interpolateWavePath(normalized);
    if (wavePathRef.current) {
      wavePathRef.current.setAttribute('d', path);
      if (waveStopEndRef.current && waveStopMidRef.current) {
        const offset = `${normalized * 100}%`;
        waveStopMidRef.current.setAttribute('offset', offset);
        waveStopEndRef.current.setAttribute('offset', offset);
        wavePathRef.current.style.stroke =
          path === LINE_PATH
            ? waveStopEndRef.current.getAttribute('stop-color') ?? ''
            : 'url(#zen-theme-picker-wave-gradient)';
      }
    }
    if (opacitySliderRef.current) {
      opacitySliderRef.current.style.setProperty('--zen-thumb-height', `${40 + normalized * 15}px`);
      opacitySliderRef.current.style.setProperty('--zen-thumb-width', `${10 + normalized * 15}px`);
    }
  }, []);

  useEffect(() => {
    updateDotsVisual(draft);
    updateTextureHandle(draft.texture ?? 0);
    updateOpacityWave(draft.opacity);
  }, [draft, updateDotsVisual, updateTextureHandle, updateOpacityWave]);

  useEffect(() => {
    return () => {
      if (bounceTimerRef.current !== null) {
        window.clearTimeout(bounceTimerRef.current);
        bounceTimerRef.current = null;
      }
    };
  }, []);

  const triggerDotBounce = useCallback(() => {
    dotRefs.current.forEach((el) => {
      if (!el) return;
      el.classList.remove('bounce');
      void el.offsetWidth;
      el.classList.add('bounce');
    });
    if (bounceTimerRef.current !== null) {
      window.clearTimeout(bounceTimerRef.current);
    }
    bounceTimerRef.current = window.setTimeout(() => {
      dotRefs.current.forEach((el) => el?.classList.remove('bounce'));
      bounceTimerRef.current = null;
    }, 520);
  }, []);

  const commitTheme = useCallback(
    (next: CustomTheme) => {
      const normalized = normalizeTheme(next);
      setDraft(normalized);
      draftRef.current = normalized;
      updateDotsVisual(normalized);
      onCommit(normalized);
    },
    [onCommit, updateDotsVisual]
  );

  const previewTheme = useCallback(
    (next: CustomTheme) => {
      const normalized = normalizeTheme(next);
      draftRef.current = normalized;
      updateDotsVisual(normalized);
      onPreview(normalized);
    },
    [onPreview, updateDotsVisual]
  );

  const handleAdd = useCallback(() => {
    if (customMode) return;
    if (draft.dots.length === 0 || draft.dots.length >= 3) return;
    const result = calculateCompliments(draft.dots, 'add', draft.harmony);
    commitTheme({ ...draft, dots: result.dots, harmony: result.harmony, enabled: true });
  }, [commitTheme, customMode, draft]);

  const handleRemove = useCallback(() => {
    if (customMode) return;
    if (draft.dots.length === 0) return;
    const trimmed = draft.dots.slice(0, -1);
    if (trimmed.length === 0) {
      commitTheme({ ...draft, dots: [], enabled: true });
      return;
    }
    const primary = trimmed[0] ?? DEFAULT_PRIMARY;
    const result = calculateCompliments(trimmed, 'remove');
    const nextLightness = shouldSyncLightness(primary)
      ? getLightnessFromDot(primary)
      : draft.lightness;
    commitTheme({
      ...draft,
      dots: result.dots,
      harmony: result.harmony,
      lightness: nextLightness,
      enabled: true,
    });
  }, [commitTheme, customMode, draft]);

  const handleDotContextMenu = useCallback(
    (event: React.MouseEvent, index: number) => {
      event.preventDefault();
      event.stopPropagation();
      if (customMode) return;
      const current = draftRef.current;
      if (current.dots.length === 0) return;
      const nextDots = current.dots.filter((_, i) => i !== index);
      if (nextDots.length === 0) {
        commitTheme({ ...current, dots: [], enabled: true });
        return;
      }
      const primary = nextDots[0] ?? DEFAULT_PRIMARY;
      const result = calculateCompliments(nextDots, 'remove');
      const nextLightness = shouldSyncLightness(primary)
        ? getLightnessFromDot(primary)
        : current.lightness;
      commitTheme({
        ...current,
        dots: result.dots,
        harmony: result.harmony,
        lightness: nextLightness,
        enabled: true,
      });
    },
    [commitTheme, customMode]
  );

  const handleToggleHarmony = useCallback(() => {
    if (customMode) return;
    const count = draft.dots.length;
    if (count <= 1) return;
    const options: ThemeHarmony[] =
      count === 2 ? ['complementary', 'singleAnalogous'] : ['splitComplementary', 'analogous', 'triadic'];
    const currentIndex = Math.max(0, options.indexOf(draft.harmony));
    const nextHarmony = options[(currentIndex + 1) % options.length] ?? draft.harmony;
    const primary = getPrimaryDot(draft);
    commitTheme({ ...draft, dots: buildDots(primary, nextHarmony), harmony: nextHarmony, enabled: true });
    triggerDotBounce();
  }, [commitTheme, customMode, draft, triggerDotBounce]);

  const handlePreset = useCallback(
    (preset: ThemePreset) => {
      if (customMode) return;
      const primary: ThemeDot = {
        x: preset.position.x,
        y: preset.position.y,
        type: preset.type ?? 'explicit-lightness',
      };
      const resolvedType = primary.type ?? 'explicit-lightness';
      const harmony = resolveHarmonyForCount(preset.numDots, preset.algo);
      const dots = buildDots(primary, harmony);
      const nextLightness =
        resolvedType === 'explicit-lightness' ? preset.lightness : getLightnessFromDot(primary);
      commitTheme({
        ...draft,
        dots,
        harmony,
        lightness: nextLightness,
        enabled: true,
      });
    },
    [commitTheme, customMode, draft]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (customMode) return;
      if (!(event.target instanceof HTMLElement)) return;
      if (event.button !== 0) return;
      const dotIndex = dotRefs.current.findIndex((el) => el === event.target);
      if (dotIndex !== 0) return;
      if (!gradientRef.current) return;
      draggingRef.current = true;
      dragPointerId.current = event.pointerId;
      setIsDragging(true);
      dotRefs.current[0]?.classList.add('dragging');
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [customMode]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (customMode) return;
      if (!draggingRef.current || !gradientRef.current) return;
      if (dragPointerId.current !== event.pointerId) return;
      const rect = gradientRef.current.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const clamped = clampToCircle(x, y);
      const primary = { ...getPrimaryDot(draftRef.current), ...clamped };
      const seedDots = [primary, ...draftRef.current.dots.slice(1)];
      const result = calculateCompliments(seedDots, 'update', draftRef.current.harmony);
      const nextLightness = shouldSyncLightness(primary)
        ? getLightnessFromDot(primary)
        : draftRef.current.lightness;
      previewTheme({
        ...draftRef.current,
        dots: result.dots,
        harmony: result.harmony,
        lightness: nextLightness,
        enabled: true,
      });
    },
    [customMode, previewTheme]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (customMode) return;
      if (!draggingRef.current) return;
      if (dragPointerId.current !== event.pointerId) return;
      draggingRef.current = false;
      dragPointerId.current = null;
      setIsDragging(false);
      dotRefs.current[0]?.classList.remove('dragging');
      markRecentlyDragged();
      commitTheme(draftRef.current);
    },
    [commitTheme, customMode, markRecentlyDragged]
  );

  const handleTexturePointerDown = useCallback((event: React.PointerEvent) => {
    if (!textureRef.current) return;
    texturePointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handleTexturePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!textureRef.current) return;
      if (texturePointerId.current !== event.pointerId) return;
      const rect = textureRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rotation = Math.atan2(event.clientY - centerY, event.clientX - centerX);
      let texture = (rotation * 180) / Math.PI + 90;
      if (texture < 0) texture += 360;
      texture /= 360;
      texture = Math.round(texture * 16) / 16;
      if (texture === 1) texture = 0;
      updateTextureHandle(texture);
      previewTheme({ ...draftRef.current, texture, enabled: true });
    },
    [previewTheme, updateTextureHandle]
  );

  const handleTexturePointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (texturePointerId.current !== event.pointerId) return;
      texturePointerId.current = null;
      commitTheme(draftRef.current);
    },
    [commitTheme]
  );

  const handlePadClick = useCallback(
    (event: React.MouseEvent) => {
      if (customMode) return;
      if (!(event.target instanceof HTMLElement)) return;
      if (draggingRef.current || recentlyDraggedRef.current) return;
      const dotIndex = dotRefs.current.findIndex((el) => el === event.target);
      if (dotIndex === 0) return;
      if (!gradientRef.current) return;
      const rect = gradientRef.current.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const clamped = clampToCircle(x, y);
      const harmony =
        draftRef.current.dots.length === 0
          ? draftRef.current.harmony
          : resolveHarmonyForCount(draftRef.current.dots.length, draftRef.current.harmony);
      const primary = { ...getPrimaryDot(draftRef.current), ...clamped };
      const seedDots = [primary, ...draftRef.current.dots.slice(1)];
      const result = calculateCompliments(seedDots, 'update', harmony);
      const nextLightness = shouldSyncLightness(primary)
        ? getLightnessFromDot(primary)
        : draftRef.current.lightness;
      commitTheme({
        ...draftRef.current,
        dots: result.dots,
        harmony: result.harmony,
        lightness: nextLightness,
        enabled: true,
      });
      triggerDotBounce();
    },
    [commitTheme, customMode, triggerDotBounce]
  );

  const handleScheme = (next: ThemeId) => {
    onSchemeChange(next);
  };

  const handleOpacity = (value: number) => {
    commitTheme({ ...draft, opacity: value, enabled: true });
  };

  const handleAccentChange = (value: string) => {
    commitTheme({ ...draft, accentColor: value, enabled: true });
  };

  const handleAccentAuto = () => {
    commitTheme({ ...draft, accentColor: null, enabled: true });
  };

  const handleAddCustomColor = () => {
    if (!canAddCustomColor) return;
    const normalized = customColor.trim();
    if (!normalized) return;
    let color = normalizeHexInput(normalized, normalized);
    const opacity = clamp(customOpacity, 0, 1);
    if (opacity < 1) {
      const hexOpacity = Math.round(opacity * 255)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();
      if (color.startsWith('#') && color.length === 7) {
        color += hexOpacity;
      }
    }
    if (!color.startsWith('#') && /^[0-9A-Fa-f]{3,6}$/.test(color)) {
      color = `#${color}`;
    }
    const nextColors = [color, ...(draft.customColors ?? [])].slice(0, CUSTOM_COLOR_LIMIT);
    commitTheme({ ...draft, customColors: nextColors, enabled: true });
    setCustomOpacity(1);
  };

  const handleRemoveCustomColor = (targetIndex: number) => {
    const nextColors = [...(draft.customColors ?? [])];
    if (targetIndex < 0 || targetIndex >= nextColors.length) return;
    nextColors.splice(targetIndex, 1);
    commitTheme({ ...draft, customColors: nextColors, enabled: true });
  };

  const derivedAccent = useMemo(
    () => normalizeHexInput(getAutoAccentColor({ ...draft, enabled: true }, scheme), '#ffffff'),
    [draft, scheme]
  );

  const accentValue = draft.accentColor ? normalizeHexInput(draft.accentColor, derivedAccent) : derivedAccent;

  const schemeButtons = useMemo(
    () => [
      { id: 'system' as ThemeId, icon: Icons.Sparkles, label: 'Auto' },
      { id: 'light' as ThemeId, icon: Icons.Sun, label: 'Light' },
      { id: 'dark' as ThemeId, icon: Icons.MoonStar, label: 'Dark' },
    ],
    []
  );

  return (
    <div className="zen-theme-picker">
      <div className="zen-theme-picker-gradient">
        <div className="zen-theme-picker-scheme">
          {schemeButtons.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              className={`zen-theme-picker-scheme-btn ${scheme === id ? 'active' : ''}`}
              title={label}
              onClick={() => handleScheme(id)}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
        <div className="zen-theme-picker-actions">
            <button
              type="button"
              onClick={handleAdd}
              disabled={customMode || draft.dots.length === 0 || draft.dots.length >= 3}
            >
              <Icons.Plus size={14} />
            </button>
            <button type="button" onClick={handleRemove} disabled={customMode || draft.dots.length === 0}>
              <Icons.Minus size={14} />
            </button>
            <button
              type="button"
              onClick={handleToggleHarmony}
              disabled={customMode || draft.dots.length <= 1}
              title={HARMONY_LABELS[draft.harmony]}
            >
              <Icons.CirclePile size={14} />
            </button>
        </div>
        <div
          className={`zen-theme-picker-pad ${isDragging ? 'is-dragging' : ''}${customMode ? ' is-disabled' : ''}`}
          ref={gradientRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handlePadClick}
        >
          {draft.dots.map((dot, index) => {
            const { hex } = getColorFromPosition(dot, draft.lightness);
            return (
              <div
                key={`dot-${index}`}
                ref={(el) => {
                  dotRefs.current[index] = el;
                }}
                className={`zen-theme-picker-dot ${index === 0 ? 'primary' : ''}`}
                onContextMenu={(event) => handleDotContextMenu(event, index)}
                style={{ left: `${dot.x * 100}%`, top: `${dot.y * 100}%`, ['--zen-theme-picker-dot-color' as string]: hex }}
              />
            );
          })}
          {draft.dots.length === 0 ? (
            <div className="zen-theme-picker-click-to-add">Click to add</div>
          ) : null}
        </div>
      </div>

      <div className="zen-theme-picker-pages">
        <button
          type="button"
          className="zen-theme-picker-page-btn"
          disabled={customMode || pageIndex === 0}
          onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
        >
          <Icons.ChevronLeft size={14} />
        </button>
        <div className="zen-theme-picker-pages-viewport">
          <div className="zen-theme-picker-pages-track" style={{ transform: `translateX(-${pageIndex * 100}%)` }}>
            {PRESET_PAGES.map((page, index) => (
              <div className="zen-theme-picker-page" key={`page-${index}`}>
                {page.map((preset, presetIndex) => {
                  const style: Record<string, string> = {};
                  if (preset.preview) {
                    style.background = `radial-gradient(circle at 0% 0%, ${preset.preview.c1}, transparent 100%), radial-gradient(circle at 100% 0%, ${preset.preview.c2}, transparent 100%), linear-gradient(to top, ${preset.preview.c3} 0%, transparent 60%)`;
                  } else if (preset.color) {
                    style.background = preset.color;
                  }
                  return (
                    <button
                      key={`preset-${index}-${presetIndex}`}
                      type="button"
                      className="zen-theme-picker-preset"
                      style={style}
                      onClick={() => handlePreset(preset)}
                      title="Preset"
                      disabled={customMode}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="zen-theme-picker-page-btn"
          disabled={customMode || pageIndex >= PRESET_PAGES.length - 1}
          onClick={() => setPageIndex((prev) => Math.min(PRESET_PAGES.length - 1, prev + 1))}
        >
          <Icons.ChevronRight size={14} />
        </button>
      </div>

      <div className="zen-theme-picker-controls">
        <div className="zen-theme-picker-opacity">
          <div className="zen-theme-picker-wave">
            <svg viewBox="51.373 -8.503 315.664 71.796" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMid meet">
              <path
                ref={wavePathRef}
                d={LINE_PATH}
                fill="none"
                stroke="url(#zen-theme-picker-wave-gradient)"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ strokeWidth: 8 }}
              />
              <defs>
                <linearGradient id="zen-theme-picker-wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.6" />
                <stop ref={waveStopMidRef} offset="0%" stopColor="var(--foreground)" stopOpacity="0.6" />
                <stop ref={waveStopEndRef} offset="100%" stopColor="var(--foreground)" stopOpacity="0.35" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <input
            type="range"
            min={OPACITY_MIN}
            max={OPACITY_MAX}
            step={0.01}
            ref={opacitySliderRef}
            value={draft.opacity}
            aria-label="Opacity"
            onChange={(event) => handleOpacity(Number(event.target.value))}
          />
        </div>
        <div className="zen-theme-picker-texture" ref={textureRef}>
          <div className="zen-theme-picker-texture-inner" />
          <div className="zen-theme-picker-texture-grain" />
          {Array.from({ length: 16 }, (_, index) => (
            <span
              key={`texture-dot-${index}`}
              className="zen-theme-picker-texture-dot"
              style={{
                left: `${50 + Math.cos((index / 16) * Math.PI * 2) * 50}%`,
                top: `${50 + Math.sin((index / 16) * Math.PI * 2) * 50}%`,
              }}
            />
          ))}
          <div
            className="zen-theme-picker-texture-handle"
            ref={textureHandleRef}
            onPointerDown={handleTexturePointerDown}
            onPointerMove={handleTexturePointerMove}
            onPointerUp={handleTexturePointerUp}
          />
        </div>
      </div>

      <div className="zen-theme-picker-custom">
        <div className="zen-theme-picker-accent">
          <div className="zen-theme-picker-custom-title">Accent color</div>
          <div className="zen-theme-picker-accent-inputs">
            <input
              type="color"
              value={accentValue}
              className="zen-theme-picker-color-input"
              onChange={(event) => handleAccentChange(event.target.value)}
              aria-label="Accent color"
            />
            <button
              type="button"
              className={`zen-theme-picker-accent-btn ${draft.accentColor ? '' : 'active'}`}
              onClick={handleAccentAuto}
            >
              Auto
            </button>
          </div>
        </div>
        <div className="zen-theme-picker-custom-title">Custom colors</div>
        <div className="zen-theme-picker-custom-inputs">
          <input
            type="color"
            value={customColor}
            className="zen-theme-picker-color-input"
            onChange={(event) => setCustomColor(event.target.value)}
          />
          <div className="zen-theme-picker-opacity-field">
            <div className="zen-theme-picker-opacity-label">
              <span>Opacity</span>
              <span>{customOpacity.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={customOpacity}
              className="zen-theme-picker-opacity-input"
              aria-label="Custom color opacity"
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isNaN(next)) return;
                setCustomOpacity(clamp(next, 0, 1));
              }}
            />
          </div>
          <button
            type="button"
            className="zen-theme-picker-icon-btn"
            onClick={handleAddCustomColor}
            disabled={!canAddCustomColor}
          >
            <Icons.Plus size={14} />
          </button>
        </div>
        <div className="zen-theme-picker-custom-list">
          {(draft.customColors ?? []).map((color, index) => (
            <div
              className="zen-theme-picker-custom-list-item"
              key={`${color}-${index}`}
              data-color={color}
            >
              <span
                className="zen-theme-picker-custom-swatch"
                style={{ ['--zen-theme-picker-dot-color' as string]: color }}
              />
              <span className="zen-theme-picker-custom-list-item-label">{color}</span>
              <button
                type="button"
                className="zen-theme-picker-custom-list-item-remove"
                onClick={() => handleRemoveCustomColor(index)}
              >
                <Icons.X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
