import { useCallback, useEffect, useRef, useState } from 'react';
import type { Settings } from '@shared/types/settings.js';
import type { Url } from '@shared/types/ids.js';
import { getBackendConfig, initBackendConfig } from '@shared/config/backend.js';
import { DEFAULT_LAYOUT_SETTINGS } from '@shared/layout/defaults.js';
import { saveSettings } from '../../api/settings.js';
import { setFlag, resetFlags } from '../../api/flags.js';
import { FLAG_DEFS, type FlagDef, type FlagKey } from '@shared/types/flags.js';
import { experimentsUnlockedItem } from '@shared/config/storage-items.js';
import { applyTheme } from '../shared/apply-theme.js';
import { useStore } from '../state/store.js';
import { useOverlayEffects } from '../state/overlay-effects.js';
import { useAnchoredDropdown } from '../hooks/useAnchoredDropdown.js';
import { Icons } from './Icon.js';
import { cn } from '../lib/utils.js';
import { toast } from 'sonner';
import { browser } from '@shared/platform/webext.js';

const UNLOCK_CLICKS = 7;
const UNLOCK_WINDOW_MS = 3000;

function FlagToggle({
  flagKey,
  def,
  value,
  onToggle,
}: {
  flagKey: FlagKey;
  def: FlagDef;
  value: unknown;
  onToggle: (key: FlagKey, value: unknown) => void;
}) {
  if (def.type === 'boolean') {
    return (
      <label className="settings-section settings-row" htmlFor={`flag-${flagKey}`}>
        <div className="settings-label-group">
          <div className="settings-label">{def.label}</div>
          <div className="settings-description">{def.description}</div>
        </div>
        <div className="settings-toggle-switch">
          <input
            id={`flag-${flagKey}`}
            className="settings-toggle-input"
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => onToggle(flagKey, e.target.checked)}
          />
          <span className="settings-toggle-control" aria-hidden="true" />
        </div>
      </label>
    );
  }
  if (def.type === 'variant') {
    return (
      <div className="settings-section">
        <div className="settings-label-group">
          <div className="settings-label">{def.label}</div>
          <div className="settings-description">{def.description}</div>
        </div>
        <Seg
          value={String(value)}
          options={def.variants}
          onChange={(v) => onToggle(flagKey, v)}
        />
      </div>
    );
  }
  return null;
}

type LayoutMode = Settings['layout']['mode'];

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="settings-seg">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={cn('settings-seg-btn', value === opt && 'active')}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function SettingsDropdown() {
  const settingsOpen = useStore((state) => state.ui.settingsOpen);
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);
  const setThemePickerOpen = useStore((state) => state.setThemePickerOpen);
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);
  const flags = useStore((state) => state.flags);
  const setFlags = useStore((state) => state.setFlags);
  const metaKey = useStore((state) => state.metaKey);

  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<Settings | null>(null);
  const [dashboardBusy, setDashboardBusy] = useState(false);

  const [experimentsUnlocked, setExperimentsUnlocked] = useState(false);
  const clickTimestamps = useRef<number[]>([]);

  useEffect(() => {
    experimentsUnlockedItem.getValue().then((unlocked) => {
      if (unlocked) setExperimentsUnlocked(true);
    }).catch(() => {});
  }, []);

  const handleGearClick = () => {
    setSettingsOpen(!settingsOpen);
    if (experimentsUnlocked) return;
    const now = Date.now();
    clickTimestamps.current = clickTimestamps.current
      .filter((t) => now - t < UNLOCK_WINDOW_MS)
      .concat(now);
    if (clickTimestamps.current.length >= UNLOCK_CLICKS) {
      clickTimestamps.current = [];
      setExperimentsUnlocked(true);
      experimentsUnlockedItem.setValue(true).catch(() => {});
      toast('Experiments unlocked');
    }
  };

  const handleFlagToggle = async (key: FlagKey, value: unknown) => {
    try {
      const updated = await setFlag(key, value);
      setFlags(updated);
    } catch (error) {
      console.error('Failed to set flag:', error);
    }
  };

  const handleResetFlags = async () => {
    try {
      const updated = await resetFlags();
      setFlags(updated);
    } catch (error) {
      console.error('Failed to reset flags:', error);
    }
  };

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useOverlayEffects(settingsOpen, { kind: 'dropdown' });
  useAnchoredDropdown({ open: settingsOpen, dropdownRef });

  // Use `inert` instead of `aria-hidden` so focus is never trapped inside a hidden ancestor.
  useEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;
    if (settingsOpen) {
      el.removeAttribute('inert');
    } else {
      el.setAttribute('inert', '');
    }
  }, [settingsOpen]);

  const layout = settings?.layout ?? DEFAULT_LAYOUT_SETTINGS;

  const settingsShortcut = metaKey ? `${metaKey.short}+,` : 'Ctrl+,';
  const tooltipsShortcut = metaKey ? `${metaKey.short}+/` : 'Ctrl+/';
  const settingsLabel = `Settings (${settingsShortcut})`;
  const settingsTooltip = `Settings (${settingsShortcut}) • Tooltips (${tooltipsShortcut})`;

  // ── Persist settings ──

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

  const scheduleSave = useCallback(
    (next: Settings) => {
      pendingSaveRef.current = next;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        void flushPendingSave();
      }, 400);
    },
    [flushPendingSave],
  );

  useEffect(
    () => () => {
      void flushPendingSave();
    },
    [flushPendingSave],
  );

  // ── Keyboard + click-outside ──

  useEffect(() => {
    if (!settingsOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSettingsOpen(false);
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (dropdownRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setSettingsOpen(false);
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onMouseDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onMouseDown, true);
    };
  }, [settingsOpen, setSettingsOpen]);

  // ── Helpers ──

  const updateSettings = (partial: Partial<Settings>) => {
    if (!settings) return;
    const next = { ...settings, ...partial };
    setSettings(next);
    if (partial.theme !== undefined || partial.customTheme !== undefined) {
      applyTheme(next.theme, next.customTheme);
    }
    scheduleSave(next);
  };

  const updateLayoutMode = (mode: LayoutMode) => {
    void updateSettings({ layout: { ...layout, mode } });
  };

  const handleOpenDashboard = async () => {
    if (dashboardBusy) return;
    setDashboardBusy(true);
    try {
      await initBackendConfig();
      const baseUrl = getBackendConfig().baseUrl;
      await browser.tabs.create({ url: `${baseUrl}` as Url, active: true });
    } catch (error) {
      console.error('Failed to open dashboard:', error);
      window?.open('https://app.gettrail.net', '_blank');
    } finally {
      setDashboardBusy(false);
    }
  };

  return (
    <div className="settings-dropdown-wrapper">
      <button
        ref={triggerRef}
        id="settingsBtn"
        className="matte-circle-btn orb-button"
        type="button"
        aria-label={settingsLabel}
        data-tooltip={settingsTooltip}
        onClick={handleGearClick}
      >
        <Icons.Settings size={18} />
      </button>

      <div
        ref={dropdownRef}
        className={`settings-dropdown${settingsOpen ? '' : ' hidden'}`}
      >
        {/* header */}
        <div className="settings-dropdown-header">
          <span className="settings-dropdown-title">settings</span>
          <button
            className="dropdown-close-btn"
            type="button"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
          >
            <Icons.X size={14} />
          </button>
        </div>

        {/* body */}
        <div className="settings-dropdown-body">
          {/* layout mode */}
          <div className="settings-section">
            <div className="settings-label">layout mode</div>
            <Seg
              value={layout.mode}
              options={['mindmap', 'tree', 'radial'] as const}
              onChange={updateLayoutMode}
            />
          </div>

          {/* hide root (tree only) */}
          {layout.mode === 'tree' && (
            <>
              <hr className="settings-hr" />
              <label className="settings-section settings-row" htmlFor="hide-root-toggle">
                <div className="settings-label">hide root paths</div>
                <div className="settings-toggle-switch">
                  <input
                    id="hide-root-toggle"
                    className="settings-toggle-input"
                    type="checkbox"
                    checked={layout.tree.hideRoot}
                    onChange={(e) =>
                      updateSettings({
                        layout: {
                          ...layout,
                          tree: { ...layout.tree, hideRoot: e.target.checked },
                        },
                      })
                    }
                  />
                  <span className="settings-toggle-control" aria-hidden="true" />
                </div>
              </label>
            </>
          )}

          <hr className="settings-hr" />

          <label className="settings-section settings-row" htmlFor="adaptive-performance-toggle">
            <div className="settings-label">adaptive performance</div>
            <div className="settings-toggle-switch">
              <input
                id="adaptive-performance-toggle"
                className="settings-toggle-input"
                type="checkbox"
                checked={settings?.adaptivePerformance ?? true}
                onChange={(e) => updateSettings({ adaptivePerformance: e.target.checked })}
              />
              <span className="settings-toggle-control" aria-hidden="true" />
            </div>
          </label>

          <hr className="settings-hr" />

          <label className="settings-section settings-row" htmlFor="keep-tabs-toggle">
            <div className="settings-label">keep tabs on switch</div>
            <div className="settings-toggle-switch">
              <input
                id="keep-tabs-toggle"
                className="settings-toggle-input"
                type="checkbox"
                checked={settings?.keepTabsOnSwitch ?? true}
                onChange={(e) => updateSettings({ keepTabsOnSwitch: e.target.checked })}
              />
              <span className="settings-toggle-control" aria-hidden="true" />
            </div>
          </label>

          <hr className="settings-hr" />

          {/* truncation */}
          <div className="settings-section">
            <div className="settings-label">title truncation</div>
            <Seg
              value={settings?.titleTruncation ?? 'middle'}
              options={['start', 'middle', 'end'] as const}
              onChange={(v) => updateSettings({ titleTruncation: v })}
            />
          </div>

          <hr className="settings-hr" />

          {/* appearance */}
          {flags?.themeStudio ? (
            <div className="settings-section settings-row">
              <div className="settings-label">appearance</div>
              <button
                className="settings-action"
                type="button"
                onClick={() => setThemePickerOpen(true)}
              >
                theme studio
                <Icons.ChevronRight size={14} />
              </button>
            </div>
          ) : (
            <div className="settings-section">
              <div className="settings-label">appearance</div>
              <Seg
                value={settings?.theme ?? 'system'}
                options={['system', 'light', 'dark'] as const}
                onChange={(v) =>
                  updateSettings({
                    theme: v,
                    customTheme: {
                      ...(settings?.customTheme ?? {
                        enabled: false,
                        dots: [],
                        harmony: 'floating' as const,
                        lightness: 50,
                        opacity: 0.6,
                        texture: 0,
                        customColors: [],
                        accentColor: null,
                      }),
                      enabled: false,
                    },
                  })
                }
              />
            </div>
          )}

          <hr className="settings-hr" />

          {/* dashboard */}
          <div className="settings-section settings-row">
            <div className="settings-label">dashboard</div>
            <button
              className="settings-action"
              type="button"
              onClick={() => void handleOpenDashboard()}
              disabled={dashboardBusy}
            >
              {dashboardBusy ? 'opening…' : 'open'}
              <Icons.ExternalLink size={13} />
            </button>
          </div>

          {experimentsUnlocked && flags && (
            <>
              <hr className="settings-hr settings-hr-dashed" />
              <div className="settings-section">
                <div className="settings-label">experiments</div>
              </div>

              {(Object.keys(FLAG_DEFS) as FlagKey[]).map((key) => (
                <FlagToggle
                  key={key}
                  flagKey={key}
                  def={FLAG_DEFS[key]}
                  value={flags[key]}
                  onToggle={(k, v) => void handleFlagToggle(k, v)}
                />
              ))}

              <div className="settings-section">
                <button
                  className="settings-action settings-reset-btn"
                  type="button"
                  onClick={() => void handleResetFlags()}
                >
                  reset all experiments
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
