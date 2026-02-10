import { useCallback, useEffect, useRef, useState } from 'react';
import type { Settings } from '../../../shared/types/settings.js';
import type { Url } from '../../../shared/types/ids.js';
import { getBackendConfig, initBackendConfig } from '../../../shared/config/backend.js';
import { DEFAULT_LAYOUT_SETTINGS } from '../../../shared/layout/defaults.js';
import { saveSettings } from '../../api/settings.js';
import { applyTheme } from '../shared/apply-theme.js';
import { useStore } from '../state/store.js';
import { Icons } from './Icon.js';
import React from 'react';

type LayoutMode = Settings['layout']['mode'];

export default function SettingsPage() {
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);
  const setThemePickerOpen = useStore((state) => state.setThemePickerOpen);
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);

  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<Settings | null>(null);
  const [dashboardBusy, setDashboardBusy] = useState(false);

  const layout = settings?.layout ?? DEFAULT_LAYOUT_SETTINGS;

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
    [flushPendingSave]
  );

  useEffect(() => () => {
    void flushPendingSave();
  }, [flushPendingSave]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSettingsOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [setSettingsOpen]);

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
      await chrome.tabs.create({ url: `${baseUrl}` as Url, active: true });
    } catch (error) {
      console.error('Failed to open dashboard:', error);
      window?.open('https://app.gettrail.net', '_blank');
    } finally {
      setDashboardBusy(false);
    }
  };

  return (
    <div className="sp">
      <div className="sp-scroll">
        {/* header */}
        <header className="sp-header">
          <button
            className="sp-back"
            type="button"
            onClick={() => setSettingsOpen(false)}
            aria-label="Back to graph"
          >
            <Icons.ChevronLeft size={16} />
          </button>
          <div>
            <h1 className="sp-title">settings</h1>
            <p className="sp-subtitle">extension preferences.</p>
          </div>
        </header>

        {/* all settings in one card, separated by dividers */}
        <div className="sp-card">
          {/* row: layout mode */}
          <div className="sp-row">
            <div className="sp-row-head">
              <span className="sp-label">layout mode</span>
              <span className="sp-hint">how your tree is arranged.</span>
            </div>
            <div className="sp-segment">
              {(['mindmap', 'tree', 'radial'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`sp-seg-btn${layout.mode === mode ? ' active' : ''}`}
                  onClick={() => updateLayoutMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="sp-divider" />

          {/* row: title truncation */}
          <div className="sp-row">
            <div className="sp-row-head">
              <span className="sp-label">title truncation</span>
              <span className="sp-hint">where long titles are shortened.</span>
            </div>
            <div className="sp-segment">
              {(['start', 'middle', 'end'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`sp-seg-btn${settings?.titleTruncation === mode ? ' active' : ''}`}
                  onClick={() => updateSettings({ titleTruncation: mode })}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="sp-divider" />

          {/* row: appearance */}
          <div className="sp-row">
            <div className="sp-row-inline">
              <div>
                <span className="sp-label">appearance</span>
                <span className="sp-hint">colors, textures, palettes.</span>
              </div>
              <button
                className="sp-btn"
                type="button"
                onClick={() => setThemePickerOpen(true)}
              >
                theme studio
                <Icons.ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="sp-divider" />

          {/* row: dashboard */}
          <div className="sp-row">
            <div className="sp-row-inline">
              <div>
                <span className="sp-label">dashboard</span>
                <span className="sp-hint">account, privacy, billing.</span>
              </div>
              <button
                className="sp-btn"
                type="button"
                onClick={() => void handleOpenDashboard()}
                disabled={dashboardBusy}
              >
                {dashboardBusy ? 'opening…' : 'open'}
                <Icons.ExternalLink size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
