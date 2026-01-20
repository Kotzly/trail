import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CustomTheme, ThemeDot, ThemeHarmony } from '../../../../shared/types/settings.js';
import type { ThemeId } from '../../shared/themes.js';
import { Icons } from '../Icon.js';
import {
  calculateCompliments,
  getColorFromPosition,
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

const DEFAULT_PRIMARY: ThemeDot = { x: 0.5, y: 0.5, type: 'explicit-lightness' };

const DEFAULT_THEME: CustomTheme = {
  enabled: false,
  dots: [{ ...DEFAULT_PRIMARY }],
  harmony: 'floating',
  lightness: 50,
  opacity: 0.6,
  texture: 0,
  customColors: [],
};

const HARMONY_LABELS: Record<ThemeHarmony, string> = {
  floating: 'Floating',
  complementary: 'Complementary',
  singleAnalogous: 'Analogous',
  splitComplementary: 'Split',
  analogous: 'Analogous',
  triadic: 'Triadic',
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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

const buildDots = (primary: ThemeDot, count: number, harmony: ThemeHarmony) => {
  if (count <= 1) return [primary];
  const expanded = [primary, ...Array.from({ length: count - 1 }, () => ({ ...primary }))];
  return calculateCompliments(expanded, harmony);
};

const normalizeTheme = (theme: CustomTheme | null | undefined): CustomTheme => {
  if (!theme) return { ...DEFAULT_THEME };
  const next = { ...DEFAULT_THEME, ...theme };
  if (!next.dots?.length) {
    next.dots = [...DEFAULT_THEME.dots];
  }
  if (!Array.isArray(next.customColors)) {
    next.customColors = [];
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
  const [customColor, setCustomColor] = useState('#6f7bf7');
  const [customOpacity, setCustomOpacity] = useState(1);
  const gradientRef = useRef<HTMLDivElement | null>(null);
  const dotRefs = useRef<Array<HTMLDivElement | null>>([]);
  const textureRef = useRef<HTMLDivElement | null>(null);
  const textureHandleRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const dragPointerId = useRef<number | null>(null);
  const texturePointerId = useRef<number | null>(null);
  const draftRef = useRef<CustomTheme>(draft);

  useEffect(() => {
    const next = normalizeTheme(value);
    setDraft(next);
    draftRef.current = next;
  }, [value]);

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
    textureHandleRef.current.style.left = `${x}%`;
    textureHandleRef.current.style.top = `${y}%`;
  }, []);

  useEffect(() => {
    updateDotsVisual(draft);
    updateTextureHandle(draft.texture ?? 0);
  }, [draft, updateDotsVisual]);

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
    const count = Math.min(3, Math.max(1, draft.dots.length + 1));
    const harmony = resolveHarmonyForCount(count, draft.harmony);
    const primary = getPrimaryDot(draft);
    commitTheme({ ...draft, dots: buildDots(primary, count, harmony), harmony, enabled: true });
  }, [commitTheme, draft]);

  const handleRemove = useCallback(() => {
    const count = Math.max(1, draft.dots.length - 1);
    const harmony = resolveHarmonyForCount(count, draft.harmony);
    const primary = getPrimaryDot(draft);
    commitTheme({ ...draft, dots: buildDots(primary, count, harmony), harmony, enabled: true });
  }, [commitTheme, draft]);

  const handleToggleHarmony = useCallback(() => {
    const count = draft.dots.length;
    if (count <= 1) return;
    const options: ThemeHarmony[] =
      count === 2 ? ['complementary', 'singleAnalogous'] : ['splitComplementary', 'analogous', 'triadic'];
    const currentIndex = Math.max(0, options.indexOf(draft.harmony));
    const nextHarmony = options[(currentIndex + 1) % options.length] ?? draft.harmony;
    const primary = getPrimaryDot(draft);
    commitTheme({ ...draft, dots: buildDots(primary, count, nextHarmony), harmony: nextHarmony, enabled: true });
  }, [commitTheme, draft]);

  const handlePreset = useCallback(
    (preset: ThemePreset) => {
      const primary: ThemeDot = {
        x: preset.position.x,
        y: preset.position.y,
        type: preset.type ?? 'explicit-lightness',
      };
      const harmony = resolveHarmonyForCount(preset.numDots, preset.algo);
      const dots = buildDots(primary, preset.numDots, harmony);
      commitTheme({
        ...draft,
        dots,
        harmony,
        lightness: preset.lightness,
        enabled: true,
      });
    },
    [commitTheme, draft]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const dotIndex = dotRefs.current.findIndex((el) => el === event.target);
      if (dotIndex !== 0) return;
      if (!gradientRef.current) return;
      draggingRef.current = true;
      dragPointerId.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [draft.enabled]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!draggingRef.current || !gradientRef.current) return;
      if (dragPointerId.current !== event.pointerId) return;
      const rect = gradientRef.current.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const clamped = clampToCircle(x, y);
      const primary = { ...getPrimaryDot(draftRef.current), ...clamped };
      const count = draftRef.current.dots.length || 1;
      const harmony = resolveHarmonyForCount(count, draftRef.current.harmony);
      const dots = buildDots(primary, count, harmony);
      previewTheme({ ...draftRef.current, dots, harmony, enabled: true });
    },
    [previewTheme]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (!draggingRef.current) return;
      if (dragPointerId.current !== event.pointerId) return;
      draggingRef.current = false;
      dragPointerId.current = null;
      commitTheme(draftRef.current);
    },
    [commitTheme]
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
      if (!(event.target instanceof HTMLElement)) return;
      const dotIndex = dotRefs.current.findIndex((el) => el === event.target);
      if (dotIndex === 0) return;
      if (!gradientRef.current) return;
      const rect = gradientRef.current.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const clamped = clampToCircle(x, y);
      const count = draftRef.current.dots.length || 1;
      const harmony = resolveHarmonyForCount(count, draftRef.current.harmony);
      const dots = buildDots({ ...getPrimaryDot(draftRef.current), ...clamped }, count, harmony);
      commitTheme({ ...draftRef.current, dots, harmony, enabled: true });
    },
    [commitTheme]
  );

  const handleScheme = (next: ThemeId) => {
    onSchemeChange(next);
  };

  const handleLightness = (value: number) => {
    commitTheme({ ...draft, lightness: value, enabled: true });
  };

  const handleOpacity = (value: number) => {
    commitTheme({ ...draft, opacity: value, enabled: true });
  };

  const handleAddCustomColor = () => {
    const normalized = customColor.trim();
    if (!normalized) return;
    let color = normalized;
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
    const nextColors = [color, ...(draft.customColors ?? [])];
    commitTheme({ ...draft, customColors: nextColors, enabled: true });
    setCustomOpacity(1);
  };

  const handleRemoveCustomColor = (target: string) => {
    const nextColors = (draft.customColors ?? []).filter((color) => color !== target);
    commitTheme({ ...draft, customColors: nextColors, enabled: true });
  };

  const lightnessPercent = clamp(draft.lightness, 0, 100);
  const opacityPercent = clamp(draft.opacity, 0, 1) * 100;

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
            <button type="button" onClick={handleAdd} disabled={draft.dots.length >= 3}>
              <Icons.Plus size={14} />
            </button>
            <button type="button" onClick={handleRemove} disabled={draft.dots.length <= 1}>
              <Icons.Minus size={14} />
            </button>
            <button
              type="button"
              onClick={handleToggleHarmony}
              disabled={draft.dots.length <= 1}
              title={HARMONY_LABELS[draft.harmony]}
            >
              <Icons.Radius size={14} />
            </button>
        </div>
        <div
          className="zen-theme-picker-pad"
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
          disabled={pageIndex === 0}
          onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
        >
          <Icons.ChevronLeft size={14} />
        </button>
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
                  />
                );
              })}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="zen-theme-picker-page-btn"
          disabled={pageIndex >= PRESET_PAGES.length - 1}
          onClick={() => setPageIndex((prev) => Math.min(PRESET_PAGES.length - 1, prev + 1))}
        >
          <Icons.ChevronRight size={14} />
        </button>
      </div>

      <div className="zen-theme-picker-controls">
        <div className="zen-theme-picker-slider">
          <div className="zen-theme-picker-slider-header">
            <span>Lightness</span>
            <span>{Math.round(lightnessPercent)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={lightnessPercent}
            style={{ ['--range-percent' as string]: `${lightnessPercent}%` }}
            onChange={(event) => handleLightness(Number(event.target.value))}
          />
        </div>
        <div className="zen-theme-picker-slider">
          <div className="zen-theme-picker-slider-header">
            <span>Opacity</span>
            <span>{Math.round(opacityPercent)}%</span>
          </div>
          <input
            type="range"
            min={0.35}
            max={1}
            step={0.01}
            value={draft.opacity}
            style={{ ['--range-percent' as string]: `${opacityPercent}%` }}
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
        <div className="zen-theme-picker-custom-title">Custom colors</div>
        <div className="zen-theme-picker-custom-inputs">
          <input
            type="color"
            value={customColor}
            onChange={(event) => setCustomColor(event.target.value)}
          />
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={customOpacity}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isNaN(next)) return;
              setCustomOpacity(clamp(next, 0, 1));
            }}
          />
          <button type="button" onClick={handleAddCustomColor}>
            <Icons.Plus size={14} />
          </button>
        </div>
        <div className="zen-theme-picker-custom-list">
          {(draft.customColors ?? []).map((color) => (
            <div className="zen-theme-picker-custom-item" key={color} data-color={color}>
              <span className="zen-theme-picker-custom-swatch" style={{ ['--zen-theme-picker-dot-color' as string]: color }} />
              <span className="zen-theme-picker-custom-label">{color}</span>
              <button type="button" onClick={() => handleRemoveCustomColor(color)}>
                <Icons.X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
