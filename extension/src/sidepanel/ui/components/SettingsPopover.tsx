import { useCallback, useEffect, useRef, useState } from 'react';
import type { Settings } from '../../../shared/types/settings.js';
import type { Url } from '../../../shared/types/ids.js';
import { getBackendConfig, initBackendConfig } from '../../../shared/config/backend.js';
import { OPTIONAL_HOST_MATCH_PATTERNS } from '../../../shared/config/site-origins.js';
import { DEFAULT_LAYOUT_SETTINGS } from '../../../shared/layout/defaults.js';
import { saveSettings } from '../../api/settings.js';
import { applyTheme } from '../shared/apply-theme.js';
import { useStore } from '../state/store.js';
import { useOverlayEffects } from '../state/overlay-effects.js';
import { useAnchoredDropdown } from '../hooks/useAnchoredDropdown.js';
import { Icons } from './Icon.js';
import { cn } from '../lib/utils.js';
import React from 'react';

type LayoutMode = Settings['layout']['mode'];
type SiteAccessState = 'loading' | 'granted' | 'not-granted';
const OPTIONAL_HOST_ORIGINS = [...OPTIONAL_HOST_MATCH_PATTERNS] as string[];

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
  const metaKey = useStore((state) => state.metaKey);

  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<Settings | null>(null);
  const [dashboardBusy, setDashboardBusy] = useState(false);
  const [siteAccessState, setSiteAccessState] = useState<SiteAccessState>('loading');
  const [siteAccessBusy, setSiteAccessBusy] = useState(false);
  const [siteAccessError, setSiteAccessError] = useState<string | null>(null);

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
      await chrome.tabs.create({ url: `${baseUrl}` as Url, active: true });
    } catch (error) {
      console.error('Failed to open dashboard:', error);
      window?.open('https://app.gettrail.net', '_blank');
    } finally {
      setDashboardBusy(false);
    }
  };

  const refreshSiteAccessState = useCallback(async () => {
    if (!chrome.permissions?.contains) {
      setSiteAccessState('not-granted');
      return;
    }
    try {
      const granted = await chrome.permissions.contains({
        origins: OPTIONAL_HOST_ORIGINS,
      });
      setSiteAccessState(granted ? 'granted' : 'not-granted');
    } catch (error) {
      console.error('Failed to check optional host permissions:', error);
      setSiteAccessState('not-granted');
    }
  }, []);

  const grantSiteAccess = useCallback(async () => {
    if (siteAccessBusy || !chrome.permissions?.request) return;
    setSiteAccessBusy(true);
    setSiteAccessError(null);
    try {
      const granted = await chrome.permissions.request({
        origins: OPTIONAL_HOST_ORIGINS,
      });
      if (!granted) {
        setSiteAccessError('Access request denied.');
        setSiteAccessState('not-granted');
        return;
      }
      setSiteAccessState('granted');
    } catch (error) {
      console.error('Failed to request optional host permissions:', error);
      setSiteAccessError('Could not request access.');
      setSiteAccessState('not-granted');
    } finally {
      setSiteAccessBusy(false);
    }
  }, [siteAccessBusy]);

  const revokeSiteAccess = useCallback(async () => {
    if (siteAccessBusy || !chrome.permissions?.remove) return;
    setSiteAccessBusy(true);
    setSiteAccessError(null);
    try {
      await chrome.permissions.remove({
        origins: OPTIONAL_HOST_ORIGINS,
      });
      setSiteAccessState('not-granted');
    } catch (error) {
      console.error('Failed to revoke optional host permissions:', error);
      setSiteAccessError('Could not revoke access.');
    } finally {
      setSiteAccessBusy(false);
    }
  }, [siteAccessBusy]);

  useEffect(() => {
    if (!settingsOpen) return;
    void refreshSiteAccessState();
  }, [refreshSiteAccessState, settingsOpen]);

  return (
    <div className="settings-dropdown-wrapper">
      <button
        ref={triggerRef}
        id="settingsBtn"
        className="matte-circle-btn orb-button"
        type="button"
        aria-label={settingsLabel}
        data-tooltip={settingsTooltip}
        onClick={() => setSettingsOpen(!settingsOpen)}
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
                <div className="settings-label">hide root</div>
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

          <hr className="settings-hr" />

          {/* optional host permissions */}
          <div className="settings-section">
            <div className="settings-row settings-row-top">
              <div className="settings-label">site access</div>
              <div className="settings-actions-inline">
                <button
                  className="settings-action"
                  type="button"
                  onClick={() => void grantSiteAccess()}
                  disabled={siteAccessBusy || siteAccessState === 'granted'}
                >
                  grant
                </button>
                <button
                  className="settings-action"
                  type="button"
                  onClick={() => void revokeSiteAccess()}
                  disabled={siteAccessBusy || siteAccessState !== 'granted'}
                >
                  revoke
                </button>
              </div>
            </div>
            <div className="settings-note">
              {siteAccessState === 'loading'
                ? 'Checking current permission state…'
                : siteAccessState === 'granted'
                  ? 'Granted: Trail can be injected on all sites when needed.'
                  : 'Not granted: Trail will use only trusted site origins.'}
            </div>
            {siteAccessError ? (
              <div className="settings-note settings-note-error">{siteAccessError}</div>
            ) : null}
          </div>

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
        </div>
      </div>
    </div>
  );
}
