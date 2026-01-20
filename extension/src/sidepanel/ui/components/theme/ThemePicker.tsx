import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CustomTheme, ThemeDot, ThemeHarmony } from '../../../../shared/types/settings.js';
import { Icons } from '../Icon.js';
import {
  calculateCompliments,
  getColorFromPosition,
  getDotColors,
  resolveHarmonyForCount,
} from '../../shared/theme-generator.js';

type Preset = {
  numDots: 1 | 3;
  algo: ThemeHarmony;
  lightness: number;
  position: { x: number; y: number };
  preview?: { c1: string; c2: string; c3: string };
  color?: string;
  type?: ThemeDot['type'];
};

const BASE_PRESET_SIZE = 380;
const normalizePos = (value: number) => value / BASE_PRESET_SIZE;

const PRESET_PAGES: Preset[][] = [
  [
    { numDots: 1, algo: 'floating', lightness: 90, position: { x: normalizePos(240), y: normalizePos(240) }, color: '#f4efdf' },
    { numDots: 1, algo: 'floating', lightness: 80, position: { x: normalizePos(233), y: normalizePos(157) }, color: '#f0b8cd' },
    { numDots: 1, algo: 'floating', lightness: 80, position: { x: normalizePos(236), y: normalizePos(111) }, color: '#e9c3e3' },
    { numDots: 1, algo: 'floating', lightness: 70, position: { x: normalizePos(234), y: normalizePos(173) }, color: '#da7682' },
    { numDots: 1, algo: 'floating', lightness: 70, position: { x: normalizePos(220), y: normalizePos(187) }, color: '#eb8570' },
    { numDots: 1, algo: 'floating', lightness: 60, position: { x: normalizePos(225), y: normalizePos(237) }, color: '#dcce7f' },
    { numDots: 1, algo: 'floating', lightness: 60, position: { x: normalizePos(147), y: normalizePos(195) }, color: '#5becad' },
    { numDots: 1, algo: 'floating', lightness: 50, position: { x: normalizePos(81), y: normalizePos(84) }, color: '#919bb5' },
  ],
  [
    {
      numDots: 3,
      algo: 'analogous',
      lightness: 90,
      position: { x: normalizePos(240), y: normalizePos(240) },
      preview: { c1: 'rgb(245, 237, 214)', c2: 'rgb(221, 243, 216)', c3: 'rgb(243, 216, 225)' },
    },
    {
      numDots: 3,
      algo: 'analogous',
      lightness: 85,
      position: { x: normalizePos(233), y: normalizePos(157) },
      preview: { c1: 'rgb(243, 190, 222)', c2: 'rgb(247, 222, 186)', c3: 'rgb(223, 195, 238)' },
    },
    {
      numDots: 3,
      algo: 'analogous',
      lightness: 80,
      position: { x: normalizePos(236), y: normalizePos(111) },
      preview: { c1: 'rgb(229, 179, 228)', c2: 'rgb(236, 172, 178)', c3: 'rgb(197, 185, 223)' },
    },
    {
      numDots: 3,
      algo: 'analogous',
      lightness: 70,
      position: { x: normalizePos(234), y: normalizePos(173) },
      preview: { c1: 'rgb(235, 122, 159)', c2: 'rgb(239, 239, 118)', c3: 'rgb(210, 133, 224)' },
    },
    {
      numDots: 3,
      algo: 'analogous',
      lightness: 70,
      position: { x: normalizePos(220), y: normalizePos(187) },
      preview: { c1: 'rgb(242, 115, 123)', c2: 'rgb(175, 242, 115)', c3: 'rgb(230, 125, 232)' },
    },
    {
      numDots: 3,
      algo: 'analogous',
      lightness: 60,
      position: { x: normalizePos(225), y: normalizePos(237) },
      preview: { c1: 'rgb(221, 205, 85)', c2: 'rgb(97, 212, 94)', c3: 'rgb(215, 91, 124)' },
    },
    {
      numDots: 3,
      algo: 'analogous',
      lightness: 60,
      position: { x: normalizePos(147), y: normalizePos(195) },
      preview: { c1: 'rgb(75, 231, 210)', c2: 'rgb(84, 175, 222)', c3: 'rgb(62, 244, 112)' },
    },
    {
      numDots: 3,
      algo: 'analogous',
      lightness: 55,
      position: { x: normalizePos(81), y: normalizePos(84) },
      preview: { c1: 'rgb(122, 132, 158)', c2: 'rgb(137, 117, 164)', c3: 'rgb(116, 162, 164)' },
    },
  ],
  [
    { numDots: 1, algo: 'floating', lightness: 10, position: { x: normalizePos(171), y: normalizePos(72) }, color: 'rgb(93, 86, 106)' },
    { numDots: 1, algo: 'floating', lightness: 40, position: { x: normalizePos(265), y: normalizePos(79) }, color: '#997096' },
    { numDots: 1, algo: 'floating', lightness: 35, position: { x: normalizePos(301), y: normalizePos(176) }, color: '#956066' },
    { numDots: 1, algo: 'floating', lightness: 30, position: { x: normalizePos(237), y: normalizePos(210) }, color: '#9c6645' },
    { numDots: 1, algo: 'floating', lightness: 30, position: { x: normalizePos(91), y: normalizePos(228) }, color: '#517b6c' },
    { numDots: 1, algo: 'floating', lightness: 25, position: { x: normalizePos(67), y: normalizePos(159) }, color: '#576e75' },
    { numDots: 1, algo: 'floating', lightness: 20, position: { x: normalizePos(314), y: normalizePos(235) }, color: 'rgb(131, 109, 95)' },
    { numDots: 1, algo: 'floating', lightness: 20, position: { x: normalizePos(118), y: normalizePos(215) }, color: '#447464' },
  ],
  [
    {
      numDots: 3,
      algo: 'analogous',
      lightness: 10,
      position: { x: normalizePos(171), y: normalizePos(72) },
      preview: { c1: 'rgb(23, 17, 34)', c2: 'rgb(37, 14, 35)', c3: 'rgb(18, 22, 33)' },
    },
    {
      numDots: 3,
      algo: 'analogous',
      lightness: 40,
      position: { x: normalizePos(265), y: normalizePos(79) },
      preview: { c1: 'rgb(128, 76, 124)', c2: 'rgb(141, 63, 66)', c3: 'rgb(97, 88, 116)' },
    },
    {
      numDots: 3,
      algo: 'analogous',
      lightness: 35,
      position: { x: normalizePos(301), y: normalizePos(176) },
      preview: { c1: 'rgb(122, 56, 64)', c2: 'rgb(126, 121, 52)', c3: 'rgb(111, 68, 110)' },
    },
    {
      numDots: 3,
      algo: 'analogous',
      lightness: 30,
      position: { x: normalizePos(237), y: normalizePos(210) },
      preview: { c1: 'rgb(131, 65, 22)', c2: 'rgb(64, 128, 25)', c3: 'rgb(122, 31, 91)' },
    },
    {
      numDots: 3,
      algo: 'analogous',
      lightness: 30,
      position: { x: normalizePos(91), y: normalizePos(228) },
      preview: { c1: 'rgb(45, 108, 85)', c2: 'rgb(52, 85, 101)', c3: 'rgb(52, 118, 35)' },
    },
    {
      numDots: 3,
      algo: 'analogous',
      lightness: 25,
      position: { x: normalizePos(67), y: normalizePos(159) },
      preview: { c1: 'rgb(45, 74, 83)', c2: 'rgb(46, 50, 81)', c3: 'rgb(38, 90, 65)' },
    },
    {
      numDots: 3,
      algo: 'analogous',
      lightness: 20,
      position: { x: normalizePos(314), y: normalizePos(235) },
      preview: { c1: 'rgb(64, 47, 38)', c2: 'rgb(55, 64, 38)', c3: 'rgb(59, 43, 52)' },
    },
    {
      numDots: 3,
      algo: 'analogous',
      lightness: 20,
      position: { x: normalizePos(118), y: normalizePos(215) },
      preview: { c1: 'rgb(22, 80, 61)', c2: 'rgb(26, 60, 76)', c3: 'rgb(27, 87, 15)' },
    },
  ],
  [
    { numDots: 1, algo: 'floating', lightness: 50, position: { x: normalizePos(337.5), y: normalizePos(180) }, color: 'rgb(224, 224, 224)', type: 'explicit-black-white' },
    { numDots: 1, algo: 'floating', lightness: 50, position: { x: normalizePos(315), y: normalizePos(180) }, color: 'rgb(192, 192, 192)', type: 'explicit-black-white' },
    { numDots: 1, algo: 'floating', lightness: 50, position: { x: normalizePos(292.5), y: normalizePos(180) }, color: 'rgb(160, 160, 160)', type: 'explicit-black-white' },
    { numDots: 1, algo: 'floating', lightness: 50, position: { x: normalizePos(270), y: normalizePos(180) }, color: 'rgb(128, 128, 128)', type: 'explicit-black-white' },
    { numDots: 1, algo: 'floating', lightness: 50, position: { x: normalizePos(247.5), y: normalizePos(180) }, color: 'rgb(96, 96, 96)', type: 'explicit-black-white' },
    { numDots: 1, algo: 'floating', lightness: 50, position: { x: normalizePos(225), y: normalizePos(180) }, color: 'rgb(64, 64, 64)', type: 'explicit-black-white' },
    { numDots: 1, algo: 'floating', lightness: 50, position: { x: normalizePos(202.5), y: normalizePos(180) }, color: 'rgb(32, 32, 32)', type: 'explicit-black-white' },
    { numDots: 1, algo: 'floating', lightness: 50, position: { x: normalizePos(180), y: normalizePos(180) }, color: 'rgb(0, 0, 0)', type: 'explicit-black-white' },
  ],
];

const HARMONY_LABELS: Record<ThemeHarmony, string> = {
  floating: 'Floating',
  complementary: 'Complementary',
  singleAnalogous: 'Analogous',
  splitComplementary: 'Split',
  analogous: 'Analogous',
  triadic: 'Triadic',
};

const DEFAULT_THEME: CustomTheme = {
  enabled: false,
  dots: [{ x: 0.5, y: 0.5, type: 'explicit-lightness' }],
  harmony: 'floating',
  lightness: 50,
  opacity: 0.6,
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

const makeDots = (primary: ThemeDot, count: number, harmony: ThemeHarmony): ThemeDot[] => {
  if (count <= 1) return [primary];
  const expanded = [primary, ...Array.from({ length: count - 1 }, () => ({ ...primary }))];
  return calculateCompliments(expanded, harmony);
};

type ThemePickerProps = {
  value: CustomTheme;
  onChange: (next: CustomTheme) => void;
};

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  const [draft, setDraft] = useState<CustomTheme>(value ?? DEFAULT_THEME);
  const [dragging, setDragging] = useState(false);
  const gradientRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!dragging) {
      setDraft(value ?? DEFAULT_THEME);
    }
  }, [value, dragging]);

  const colors = useMemo(() => getDotColors(draft.dots, draft.lightness), [draft.dots, draft.lightness]);

  const commit = useCallback(
    (patch: Partial<CustomTheme>, forceEnable = true) => {
      const next = { ...draft, ...patch };
      if (forceEnable) {
        next.enabled = true;
      }
      setDraft(next);
      onChange(next);
    },
    [draft, onChange]
  );

  const setDots = useCallback(
    (dots: ThemeDot[], harmony?: ThemeHarmony, enable = true) => {
      const resolvedHarmony = harmony ?? resolveHarmonyForCount(dots.length, draft.harmony);
      commit({ dots, harmony: resolvedHarmony }, enable);
    },
    [commit, draft.harmony]
  );

  const handleAdd = useCallback(() => {
    const count = Math.min(3, Math.max(1, draft.dots.length + 1));
    const harmony = resolveHarmonyForCount(count, draft.harmony);
    const primary = draft.dots[0] ?? { x: 0.5, y: 0.5, type: 'explicit-lightness' };
    setDots(makeDots(primary, count, harmony), harmony);
  }, [draft.dots, draft.harmony, setDots]);

  const handleRemove = useCallback(() => {
    const count = Math.max(1, draft.dots.length - 1);
    const harmony = resolveHarmonyForCount(count, draft.harmony);
    const primary = draft.dots[0] ?? { x: 0.5, y: 0.5, type: 'explicit-lightness' };
    setDots(makeDots(primary, count, harmony), harmony);
  }, [draft.dots, draft.harmony, setDots]);

  const handleToggleHarmony = useCallback(() => {
    const count = draft.dots.length;
    if (count === 1) return;
    const available: ThemeHarmony[] =
      count === 2 ? ['complementary', 'singleAnalogous'] : ['splitComplementary', 'analogous', 'triadic'];
    const currentIndex = Math.max(0, available.indexOf(draft.harmony));
    const nextHarmony = available[(currentIndex + 1) % available.length];
    const primary = draft.dots[0] ?? { x: 0.5, y: 0.5, type: 'explicit-lightness' };
    setDots(makeDots(primary, count, nextHarmony), nextHarmony);
  }, [draft.dots, draft.harmony, setDots]);

  const handlePreset = useCallback(
    (preset: Preset) => {
      const primary: ThemeDot = {
        x: preset.position.x,
        y: preset.position.y,
        type: preset.type ?? 'explicit-lightness',
      };
      const harmony = resolveHarmonyForCount(preset.numDots, preset.algo);
      const dots = makeDots(primary, preset.numDots, harmony);
      commit({ dots, harmony, lightness: preset.lightness }, true);
    },
    [commit]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragging || !gradientRef.current) return;
      const rect = gradientRef.current.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const clamped = clampToCircle(x, y);
      const primary = { ...(draft.dots[0] ?? { x: 0.5, y: 0.5, type: 'explicit-lightness' }), ...clamped };
      const dots = makeDots(primary, draft.dots.length || 1, resolveHarmonyForCount(draft.dots.length || 1, draft.harmony));
      setDots(dots, draft.harmony, true);
    },
    [dragging, draft.dots, draft.harmony, setDots]
  );

  const handlePointerUp = useCallback(() => {
    if (dragging) {
      setDragging(false);
    }
  }, [dragging]);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragging, handlePointerMove, handlePointerUp]);

  const handleToggleEnabled = useCallback(
    (enabled: boolean) => {
      commit({ enabled }, false);
    },
    [commit]
  );

  const resetTheme = useCallback(() => {
    onChange({ ...DEFAULT_THEME });
  }, [onChange]);

  const lightnessPercent = clamp(draft.lightness, 0, 100);
  const opacityPercent = clamp(draft.opacity, 0, 1) * 100;

  return (
    <div className="theme-picker">
      <label className="settings-toggle-row" htmlFor="custom-theme-toggle">
        <div className="settings-toggle-text">
          <div className="settings-toggle-title">Custom theme</div>
          <div className="settings-toggle-description">Use your own palette for the entire UI.</div>
        </div>
        <input
          id="custom-theme-toggle"
          className="settings-toggle-input"
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) => handleToggleEnabled(event.target.checked)}
        />
        <span className="settings-toggle-track" />
      </label>

      <div className={`theme-picker-surface ${draft.enabled ? '' : 'disabled'}`}>
        <div className="theme-picker-gradient" ref={gradientRef}>
          <div className="theme-picker-ring" />
          {draft.dots.map((dot, index) => {
            const { hex } = getColorFromPosition(dot, draft.lightness);
            return (
              <div
                key={`dot-${index}`}
                className={`theme-picker-dot ${index === 0 ? 'primary' : 'secondary'}`}
                style={{ left: `${dot.x * 100}%`, top: `${dot.y * 100}%`, ['--dot-color' as string]: hex }}
                onPointerDown={(event) => {
                  if (index !== 0 || !draft.enabled) return;
                  event.preventDefault();
                  setDragging(true);
                }}
              />
            );
          })}
          {draft.dots.length === 0 ? (
            <div className="theme-picker-empty">Click to add a color</div>
          ) : null}
          <div className="theme-picker-actions">
            <button type="button" onClick={handleAdd} disabled={!draft.enabled || draft.dots.length >= 3}>
              <Icons.Plus size={14} />
            </button>
            <button type="button" onClick={handleRemove} disabled={!draft.enabled || draft.dots.length <= 1}>
              <Icons.Trash2 size={14} />
            </button>
            <button type="button" onClick={handleToggleHarmony} disabled={!draft.enabled || draft.dots.length <= 1}>
              <Icons.Radius size={14} />
              <span>{HARMONY_LABELS[draft.harmony]}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="theme-picker-sliders">
        <div className="popover-slider">
          <div className="popover-slider-header">
            <span className="popover-label-small">Lightness</span>
            <span className="popover-slider-value">{Math.round(lightnessPercent)}</span>
          </div>
          <input
            type="range"
            className="popover-range"
            min={0}
            max={100}
            step={1}
            value={lightnessPercent}
            style={{ ['--range-percent' as string]: `${lightnessPercent}%` }}
            onChange={(event) => {
              commit({ lightness: Number(event.target.value) });
            }}
          />
        </div>
        <div className="popover-slider">
          <div className="popover-slider-header">
            <span className="popover-label-small">Opacity</span>
            <span className="popover-slider-value">{Math.round(opacityPercent)}%</span>
          </div>
          <input
            type="range"
            className="popover-range"
            min={0.2}
            max={1}
            step={0.01}
            value={draft.opacity}
            style={{ ['--range-percent' as string]: `${opacityPercent}%` }}
            onChange={(event) => {
              commit({ opacity: Number(event.target.value) });
            }}
          />
        </div>
      </div>

      <div className="theme-picker-presets">
        {PRESET_PAGES.map((page, pageIndex) => (
          <div className="theme-picker-presets-row" key={`preset-page-${pageIndex}`}>
            {page.map((preset, index) => {
              const style: Record<string, string> = {};
              if (preset.preview) {
                style.background = `radial-gradient(circle at 0% 0%, ${preset.preview.c1}, transparent 100%), radial-gradient(circle at 100% 0%, ${preset.preview.c2}, transparent 100%), linear-gradient(to top, ${preset.preview.c3} 0%, transparent 60%)`;
              } else if (preset.color) {
                style.background = preset.color;
              }
              return (
                <button
                  key={`preset-${pageIndex}-${index}`}
                  className="theme-picker-preset"
                  type="button"
                  title={`Preset ${index + 1}`}
                  style={style}
                  onClick={() => handlePreset(preset)}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="theme-picker-preview">
        {colors.map((color, index) => (
          <div key={`color-${index}`} className="theme-picker-color-chip" style={{ background: color }}>
            {index === 0 ? 'Primary' : 'Accent'}
          </div>
        ))}
      </div>

      <button className="popover-reset-btn secondary" type="button" onClick={resetTheme}>
        Reset custom theme
      </button>
    </div>
  );
}
