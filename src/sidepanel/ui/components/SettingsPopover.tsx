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
import { resetNodeLayouts } from '../../api/tree.js';
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
  onValueCommit?: (value: number) => void;
};

function RangeSlider({
  value,
  min,
  max,
  step,
  onValueChange,
  onValueCommit,
  label,
  valueLabel,
}: DragNumberInputProps & { label: string; valueLabel?: string }) {
  const formattedValue =
    valueLabel ??
    (step < 1
      ? Number.isFinite(value)
        ? value.toFixed(2)
        : '0'
      : String(Math.round(value)));
  return (
    <div className="popover-slider">
      <div className="popover-slider-header">
        <span className="popover-label-small">{label}</span>
        <span className="popover-slider-value">{formattedValue}</span>
      </div>
      <input
        type="range"
        className="popover-range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = clamp(Number(event.target.value), min, max);
          onValueChange(next);
        }}
        onPointerUp={(event) => {
          if (!onValueCommit) return;
          const next = clamp(Number(event.currentTarget.value), min, max);
          onValueCommit(next);
        }}
        onKeyUp={(event) => {
          if (!onValueCommit) return;
          const next = clamp(Number((event.currentTarget as HTMLInputElement).value), min, max);
          onValueCommit(next);
        }}
      />
    </div>
  );
}

export default function SettingsPopover({ anchorRef }: SettingsPopoverProps) {
  const settingsOpen = useStore((state) => state.ui.settingsOpen);
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);
  const requestGraphReset = useStore((state) => state.requestGraphReset);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<Settings | null>(null);

  const themeIds = useMemo(() => [THEME_IDS.LIGHT, THEME_IDS.DARK, THEME_IDS.SYSTEM], []);
  const layout = settings?.layout ?? DEFAULT_LAYOUT_SETTINGS;
  const layoutHints: Record<Settings['layout']['mode'], string> = {
    mindmap: 'best for short journeys',
    tree: 'best for long journeys',
    radial: 'best for many short journeys',
  };
  const layoutLabels: Record<Settings['layout']['mode'], string> = {
    mindmap: 'Mindmap',
    tree: 'Tree',
    radial: 'Radial',
  };
  const tabLimitMax = Math.max(50, settings?.maxOpenTabs ?? 0);
  const rawCapacity = settings?.capacity;
  const capacityValue = Number.isFinite(rawCapacity) ? (rawCapacity as number) : 0;
  const capacityMax = Number.isFinite(rawCapacity) ? Math.max(500, rawCapacity as number) : 5000;
  const [tabLimitDraft, setTabLimitDraft] = useState<number>(settings?.maxOpenTabs ?? 0);
  const [capacityDraft, setCapacityDraft] = useState<number>(capacityValue);

  const updatePosition = useCallback(() => {
    if (!settingsOpen) return;
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;
    const btnRect = anchor.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();
    const margin = 8;
    let left = btnRect.left + btnRect.width / 2 - popRect.width / 2;
    left = Math.min(Math.max(margin, left), window.innerWidth - popRect.width - margin);
    let top = btnRect.bottom + 8;
    if (top + popRect.height > window.innerHeight - margin) {
      top = Math.max(margin, btnRect.top - popRect.height - 8);
    }
    setStyle({ left, top });
  }, [anchorRef, settingsOpen]);

  useLayoutEffect(() => {
    updatePosition();
  }, [layout.mode, settingsOpen, updatePosition]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handleResize = () => updatePosition();
    window.addEventListener('resize', handleResize);
    const popover = popoverRef.current;
    const anchor = anchorRef.current;
    const observer = new ResizeObserver(() => updatePosition());
    if (popover) observer.observe(popover);
    if (anchor) observer.observe(anchor);
    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [anchorRef, settingsOpen, updatePosition]);

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

  useEffect(() => {
    setTabLimitDraft(settings?.maxOpenTabs ?? 0);
  }, [settings?.maxOpenTabs]);

  useEffect(() => {
    setCapacityDraft(capacityValue);
  }, [capacityValue]);

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
        mode: layout.mode,
        tree: { ...DEFAULT_LAYOUT_SETTINGS.tree },
        mindmap: { ...DEFAULT_LAYOUT_SETTINGS.mindmap },
        radial: { ...DEFAULT_LAYOUT_SETTINGS.radial },
      },
    });
  };
  const resetView = async () => {
    void updateSettings({
      layout: {
        mode: layout.mode,
        tree: { ...DEFAULT_LAYOUT_SETTINGS.tree },
        mindmap: { ...DEFAULT_LAYOUT_SETTINGS.mindmap },
        radial: { ...DEFAULT_LAYOUT_SETTINGS.radial },
      },
    });
    try {
      await resetNodeLayouts();
    } catch (error) {
      console.error('Failed to reset node layouts:', error);
    }
    requestGraphReset();
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
          <RangeSlider
            label="Tab limit"
            value={tabLimitDraft}
            min={0}
            max={tabLimitMax}
            step={1}
            valueLabel={tabLimitDraft === 0 ? '∞' : String(tabLimitDraft)}
            onValueChange={(value) => {
              const maxOpenTabs = Number.isFinite(value) && value >= 0 ? value : 0;
              setTabLimitDraft(maxOpenTabs);
            }}
            onValueCommit={(value) => {
              const maxOpenTabs = Number.isFinite(value) && value >= 0 ? value : 0;
              void updateSettings({ maxOpenTabs });
            }}
          />
        </div>

        <div className="popover-section">
          <RangeSlider
            label="Tree capacity"
            value={capacityDraft}
            min={0}
            max={capacityMax}
            step={50}
            valueLabel={capacityDraft === 0 ? '∞' : String(Math.round(capacityDraft))}
            onValueChange={(value) => {
              const capacity = value <= 0 ? Infinity : Math.max(1, Math.round(value));
              setCapacityDraft(capacity === Infinity ? 0 : capacity);
            }}
            onValueCommit={(value) => {
              const capacity = value <= 0 ? Infinity : Math.max(1, Math.round(value));
              void updateSettings({ capacity });
            }}
          />
          <div className="popover-hint">Pinned nodes are never evicted</div>
        </div>

        <div className="popover-section">
          <div className="popover-label-small">Title truncation</div>
          <div className="popover-segment">
            <button
              type="button"
              className={`popover-segment-btn wide ${settings?.titleTruncation === 'start' ? 'active' : ''}`}
              onClick={() => updateSettings({ titleTruncation: 'start' })}
            >
              Start
            </button>
            <button
              type="button"
              className={`popover-segment-btn wide ${settings?.titleTruncation === 'middle' ? 'active' : ''}`}
              onClick={() => updateSettings({ titleTruncation: 'middle' })}
            >
              Middle
            </button>
            <button
              type="button"
              className={`popover-segment-btn wide ${settings?.titleTruncation === 'end' ? 'active' : ''}`}
              onClick={() => updateSettings({ titleTruncation: 'end' })}
            >
              End
            </button>
          </div>
          <div className="popover-hint">Where long titles are shortened</div>
        </div>

        <div className="popover-section">
          <div className="popover-label-small">Layout</div>
          <div className="popover-segment">
            <button
              type="button"
              className={`popover-segment-btn ${layout.mode === 'mindmap' ? 'active' : ''}`}
              onClick={() => updateLayout({ mode: 'mindmap' })}
              aria-label="Mindmap layout"
            >
              <Icons.BrainCircuit size={14} />
            </button>
            <button
              type="button"
              className={`popover-segment-btn ${layout.mode === 'tree' ? 'active' : ''}`}
              onClick={() => updateLayout({ mode: 'tree' })}
              aria-label="Tree layout"
            >
              <Icons.Network size={14} />
            </button>
            <button
              type="button"
              className={`popover-segment-btn ${layout.mode === 'radial' ? 'active' : ''}`}
              onClick={() => updateLayout({ mode: 'radial' })}
              aria-label="Radial layout"
            >
              <Icons.Radius size={14} />
            </button>
          </div>
          <div className="layout-selected-label">{layoutLabels[layout.mode]}</div>
          <div className="popover-hint">{layoutHints[layout.mode]}</div>
          <button type="button" className="popover-reset-btn" onClick={resetLayout}>
            Reset to defaults
          </button>
          <button type="button" className="popover-reset-btn secondary" onClick={resetView}>
            Reset view (factory)
          </button>
        </div>

        {layout.mode === 'tree' ? (
          <div className="popover-section">
            <RangeSlider
              label="Vertical gap"
              value={layout.tree.verticalGapScale}
              min={0.4}
              max={3}
              step={0.05}
              onValueChange={(value) => updateLayout({ tree: { verticalGapScale: value } })}
            />
            <RangeSlider
              label="Horizontal gap"
              value={layout.tree.horizontalGapScale}
              min={0.4}
              max={3}
              step={0.05}
              onValueChange={(value) => updateLayout({ tree: { horizontalGapScale: value } })}
            />
          </div>
        ) : layout.mode === 'mindmap' ? (
          <div className="popover-section">
            <RangeSlider
              label="Vertical gap"
              value={layout.mindmap.verticalGapScale}
              min={0.4}
              max={3}
              step={0.05}
              onValueChange={(value) => updateLayout({ mindmap: { verticalGapScale: value } })}
            />
            <RangeSlider
              label="Horizontal gap"
              value={layout.mindmap.horizontalGapScale}
              min={0.4}
              max={3}
              step={0.05}
              onValueChange={(value) => updateLayout({ mindmap: { horizontalGapScale: value } })}
            />
          </div>
        ) : (
          <div className="popover-section">
            <RangeSlider
              label="Angle weight"
              value={layout.radial.angleWeightExp}
              min={0.2}
              max={1.2}
              step={0.01}
              onValueChange={(value) => updateLayout({ radial: { angleWeightExp: value } })}
            />
            <RangeSlider
              label="Min span factor"
              value={layout.radial.minSpanFactor}
              min={0.4}
              max={0.95}
              step={0.01}
              onValueChange={(value) => updateLayout({ radial: { minSpanFactor: value } })}
            />
            <RangeSlider
              label="Min span (rad)"
              value={layout.radial.minSpanAbs}
              min={0.04}
              max={0.5}
              step={0.01}
              onValueChange={(value) => updateLayout({ radial: { minSpanAbs: value } })}
            />
            <RangeSlider
              label="Required scale"
              value={layout.radial.requiredScale}
              min={0.35}
              max={1.2}
              step={0.05}
              onValueChange={(value) => updateLayout({ radial: { requiredScale: value } })}
            />
            <RangeSlider
              label="Depth gap"
              value={layout.radial.depthGapBase}
              min={0.6}
              max={2.5}
              step={0.05}
              onValueChange={(value) => updateLayout({ radial: { depthGapBase: value } })}
            />
            <RangeSlider
              label="Gap growth"
              value={layout.radial.depthGapGrowth}
              min={0}
              max={0.8}
              step={0.02}
              onValueChange={(value) => updateLayout({ radial: { depthGapGrowth: value } })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
