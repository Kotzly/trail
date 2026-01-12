import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import type {
  LayoutSettings,
  MindmapLayoutSettings,
  RadialLayoutSettings,
  Settings,
  TreeLayoutSettings,
} from '../../../shared/types/settings.js';
import { DEFAULT_LAYOUT_SETTINGS } from '../../../shared/layout/defaults.js';
import { saveSettings } from '../../api/settings.js';
import { THEME_IDS } from '../shared/themes.js';
import { useStore } from '../state/store.js';
import { Icons } from './Icon.js';
import React from 'react';

type SettingsPopoverProps = {
  anchorRef: RefObject<HTMLButtonElement>;
};

function applyTheme(theme: string): void {
  document.documentElement.setAttribute('data-theme', theme);
}

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;

type DragNumberInputProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  className?: string;
  onValueChange: (value: number) => void;
};

function DragNumberInput({
  value,
  min,
  max,
  step,
  className,
  onValueChange,
}: DragNumberInputProps) {
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const handlePointerDown = (event: React.PointerEvent<HTMLInputElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startValue = valueRef.current;
    const sensitivity = step * 0.2;

    const handleMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const next = clamp(startValue + delta * sensitivity, min, max);
      onValueChange(Number(next.toFixed(4)));
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = clamp(Number(event.target.value), min, max);
    onValueChange(next);
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      className={className}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={handleChange}
      onPointerDown={handlePointerDown}
    />
  );
}

export default function SettingsPopover({ anchorRef }: SettingsPopoverProps) {
  const settingsOpen = useStore((state) => state.ui.settingsOpen);
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<Settings | null>(null);

  const themeIds = useMemo(() => [THEME_IDS.LIGHT, THEME_IDS.DARK, THEME_IDS.SYSTEM], []);
  const layout = settings?.layout ?? DEFAULT_LAYOUT_SETTINGS;

  useLayoutEffect(() => {
    if (!settingsOpen) return;
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;
    const btnRect = anchor.getBoundingClientRect();
    const popoverWidth = 172;
    let left = btnRect.right - popoverWidth;
    let top = btnRect.bottom + 8;

    if (left < 8) left = 8;
    let transform = '';
    if (top + 200 > window.innerHeight) {
      top = btnRect.top - 8;
      transform = 'translateY(-100%)';
    }

    setStyle({ left, top, transform });
  }, [anchorRef, settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      setSettingsOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [anchorRef, setSettingsOpen, settingsOpen]);

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const toSave = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (!toSave) return;
    try {
      await saveSettings(toSave);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, []);

  const scheduleSave = useCallback((next: Settings) => {
    pendingSaveRef.current = next;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void flushPendingSave();
    }, 400);
  }, [flushPendingSave]);

  useEffect(() => {
    if (!settingsOpen) {
      void flushPendingSave();
    }
  }, [flushPendingSave, settingsOpen]);

  useEffect(() => () => {
    void flushPendingSave();
  }, [flushPendingSave]);

  const updateSettings = async (partial: Partial<Settings>) => {
    if (!settings) return;
    const next = { ...settings, ...partial };
    setSettings(next);
    applyTheme(next.theme);
    scheduleSave(next);
  };

  type LayoutPatch = {
    mode?: LayoutSettings['mode'];
    tree?: Partial<TreeLayoutSettings>;
    mindmap?: Partial<MindmapLayoutSettings>;
    radial?: Partial<RadialLayoutSettings>;
  };

  const updateLayout = (partial: LayoutPatch) => {
    const next: LayoutSettings = {
      ...layout,
      ...partial,
      tree: { ...layout.tree, ...(partial.tree ?? {}) },
      mindmap: { ...layout.mindmap, ...(partial.mindmap ?? {}) },
      radial: { ...layout.radial, ...(partial.radial ?? {}) },
    };
    void updateSettings({ layout: next });
  };

  const resetLayout = () => {
    void updateSettings({
      layout: {
        mode: DEFAULT_LAYOUT_SETTINGS.mode,
        tree: { ...DEFAULT_LAYOUT_SETTINGS.tree },
        mindmap: { ...DEFAULT_LAYOUT_SETTINGS.mindmap },
        radial: { ...DEFAULT_LAYOUT_SETTINGS.radial },
      },
    });
  };

  if (!settingsOpen) return null;

  return (
    <div ref={popoverRef} className="settings-popover" id="settingsPopover" style={style}>
      <div className="settings-content">
        <div className="popover-section">
          <div className="popover-label-small">Theme</div>
          <div className="popover-icons" id="themeIcons">
            {themeIds.map((themeId) => (
              <button
                key={themeId}
                className={`popover-icon-btn ${settings?.theme === themeId ? 'active' : ''}`}
                data-theme={themeId}
                title={themeId[0]!.toUpperCase() + themeId.slice(1)}
                type="button"
                onClick={() => updateSettings({ theme: themeId })}
              >
                {themeId === THEME_IDS.LIGHT ? (
                  <Icons.Sun size={18} />
                ) : themeId === THEME_IDS.DARK ? (
                  <Icons.Moon size={18} />
                ) : (
                  <Icons.Laptop2 size={18} />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="popover-section">
          <div className="popover-row">
            <span className="popover-label-small">Tab Limit</span>
            <input
              type="number"
              id="multiTabLimit"
              min="0"
              className="popover-input-small"
              value={settings?.maxOpenTabs ?? 0}
              onChange={(event) => {
                const value = Number(event.target.value);
                const maxOpenTabs = Number.isFinite(value) && value >= 0 ? value : 0;
                void updateSettings({ maxOpenTabs });
              }}
            />
          </div>
          <div className="popover-hint">0 = unlimited</div>
        </div>

        <div className="popover-section">
          <div className="popover-label-small">Layout</div>
          <div className="popover-segment">
            <button
              type="button"
              className={`popover-segment-btn ${layout.mode === 'tree' ? 'active' : ''}`}
              onClick={() => updateLayout({ mode: 'tree' })}
            >
              Tree
            </button>
            <button
              type="button"
              className={`popover-segment-btn ${layout.mode === 'mindmap' ? 'active' : ''}`}
              onClick={() => updateLayout({ mode: 'mindmap' })}
            >
              Mindmap
            </button>
            <button
              type="button"
              className={`popover-segment-btn ${layout.mode === 'radial' ? 'active' : ''}`}
              onClick={() => updateLayout({ mode: 'radial' })}
            >
              Radial
            </button>
          </div>
          <button type="button" className="popover-reset-btn" onClick={resetLayout}>
            Reset to defaults
          </button>
        </div>

        {layout.mode === 'tree' ? (
          <div className="popover-section">
            <div className="popover-row">
              <span className="popover-label-small">Vertical gap</span>
              <DragNumberInput
                value={layout.tree.verticalGapScale}
                step={0.1}
                min={0.4}
                max={3}
                className="popover-input-small drag-number"
                onValueChange={(value) => updateLayout({ tree: { verticalGapScale: value } })}
              />
            </div>
            <div className="popover-row">
              <span className="popover-label-small">Horizontal gap</span>
              <DragNumberInput
                value={layout.tree.horizontalGapScale}
                step={0.1}
                min={0.4}
                max={3}
                className="popover-input-small drag-number"
                onValueChange={(value) => updateLayout({ tree: { horizontalGapScale: value } })}
              />
            </div>
          </div>
        ) : layout.mode === 'mindmap' ? (
          <div className="popover-section">
            <div className="popover-row">
              <span className="popover-label-small">Vertical gap</span>
              <DragNumberInput
                value={layout.mindmap.verticalGapScale}
                step={0.1}
                min={0.4}
                max={3}
                className="popover-input-small drag-number"
                onValueChange={(value) => updateLayout({ mindmap: { verticalGapScale: value } })}
              />
            </div>
            <div className="popover-row">
              <span className="popover-label-small">Horizontal gap</span>
              <DragNumberInput
                value={layout.mindmap.horizontalGapScale}
                step={0.1}
                min={0.4}
                max={3}
                className="popover-input-small drag-number"
                onValueChange={(value) => updateLayout({ mindmap: { horizontalGapScale: value } })}
              />
            </div>
          </div>
        ) : (
          <div className="popover-section">
            <div className="popover-row">
              <span className="popover-label-small">Angle weight</span>
              <DragNumberInput
                value={layout.radial.angleWeightExp}
                step={0.01}
                min={0.2}
                max={1.2}
                className="popover-input-small drag-number"
                onValueChange={(value) => updateLayout({ radial: { angleWeightExp: value } })}
              />
            </div>
            <div className="popover-row">
              <span className="popover-label-small">Min span factor</span>
              <DragNumberInput
                value={layout.radial.minSpanFactor}
                step={0.01}
                min={0.4}
                max={0.95}
                className="popover-input-small drag-number"
                onValueChange={(value) => updateLayout({ radial: { minSpanFactor: value } })}
              />
            </div>
            <div className="popover-row">
              <span className="popover-label-small">Min span (rad)</span>
              <DragNumberInput
                value={layout.radial.minSpanAbs}
                step={0.01}
                min={0.04}
                max={0.5}
                className="popover-input-small drag-number"
                onValueChange={(value) => updateLayout({ radial: { minSpanAbs: value } })}
              />
            </div>
            <div className="popover-row">
              <span className="popover-label-small">Required scale</span>
              <DragNumberInput
                value={layout.radial.requiredScale}
                step={0.05}
                min={0.35}
                max={1.2}
                className="popover-input-small drag-number"
                onValueChange={(value) => updateLayout({ radial: { requiredScale: value } })}
              />
            </div>
            <div className="popover-row">
              <span className="popover-label-small">Depth gap</span>
              <DragNumberInput
                value={layout.radial.depthGapBase}
                step={0.05}
                min={0.6}
                max={2.5}
                className="popover-input-small drag-number"
                onValueChange={(value) => updateLayout({ radial: { depthGapBase: value } })}
              />
            </div>
            <div className="popover-row">
              <span className="popover-label-small">Gap growth</span>
              <DragNumberInput
                value={layout.radial.depthGapGrowth}
                step={0.02}
                min={0}
                max={0.8}
                className="popover-input-small drag-number"
                onValueChange={(value) => updateLayout({ radial: { depthGapGrowth: value } })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
