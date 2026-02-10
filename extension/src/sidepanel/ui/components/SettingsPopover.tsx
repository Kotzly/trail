import { useCallback, useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
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

const LAYOUT_OPTIONS: Array<{ id: LayoutMode; label: string; description: string; icon: LucideIcon }> = [
  {
    id: 'mindmap',
    label: 'Mindmap',
    description: 'Best for exploratory branches.',
    icon: Icons.BrainCircuit,
  },
  {
    id: 'tree',
    label: 'Tree',
    description: 'Best for long journeys.',
    icon: Icons.Network,
  },
  {
    id: 'radial',
    label: 'Radial',
    description: 'Best for dense clusters.',
    icon: Icons.Radius,
  },
];

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

  // Flush on unmount
  useEffect(() => () => {
    void flushPendingSave();
  }, [flushPendingSave]);

  // Escape to close
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
    const next = {
      ...layout,
      mode,
    };
    void updateSettings({ layout: next });
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
    <div className="settings-page">
      <div className="settings-page-scroll">
        <div className="settings-page-head">
          <button
            className="settings-back-btn"
            type="button"
            onClick={() => setSettingsOpen(false)}
            aria-label="Back to graph"
          >
            <Icons.ChevronLeft size={18} />
          </button>
          <div>
            <div className="settings-page-title">Settings</div>
            <div className="settings-page-subtitle">Personalize your Trail workspace.</div>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-title">Layout mode</div>
          <div className="settings-card-hint">Pick a structure that matches how you browse.</div>
          <div className="settings-choice-grid">
            {LAYOUT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = layout.mode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`settings-choice ${active ? 'active' : ''}`}
                  aria-pressed={active}
                  onClick={() => updateLayoutMode(option.id)}
                >
                  <span className="settings-choice-icon">
                    <Icon size={16} />
                  </span>
                  <span className="settings-choice-text">
                    <span className="settings-choice-title">{option.label}</span>
                    <span className="settings-choice-hint">{option.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-title">Appearance</div>
          <div className="settings-card-hint">
            Customize colors, textures, and palettes.
          </div>
          <button
            className="settings-secondary-btn"
            type="button"
            onClick={() => setThemePickerOpen(true)}
          >
            Open Theme Studio
          </button>
        </div>

        <div className="settings-card">
          <div className="settings-card-title">Title truncation</div>
          <div className="settings-card-hint">Where long titles are shortened.</div>
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
        </div>

        <div className="settings-card subtle">
          <div className="settings-card-title">Dashboard</div>
          <div className="settings-card-hint">
            Account, privacy, and subscriptions are managed on the web.
          </div>
          <button
            className="settings-primary-btn"
            type="button"
            onClick={() => void handleOpenDashboard()}
            disabled={dashboardBusy}
          >
            {dashboardBusy ? 'Opening…' : 'Open Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
