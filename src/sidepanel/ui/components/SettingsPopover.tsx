import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import type { Settings } from '../../../shared/types/settings.js';
import { saveSettings } from '../../api/settings.js';
import { THEME_IDS } from '../shared/themes.js';
import { useStore } from '../state/store.js';
import React from 'react';


type SettingsPopoverProps = {
  anchorRef: RefObject<HTMLButtonElement>;
};

function applyTheme(theme: string): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export default function SettingsPopover({ anchorRef }: SettingsPopoverProps) {
  const settingsOpen = useStore((state) => state.ui.settingsOpen);
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  const themeIds = useMemo(() => [THEME_IDS.LIGHT, THEME_IDS.DARK, THEME_IDS.SYSTEM], []);

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

  const updateSettings = async (partial: Partial<Settings>) => {
    if (!settings) return;
    const next = { ...settings, ...partial };
    setSettings(next);
    applyTheme(next.theme);
    try {
      await saveSettings(next);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  if (!settingsOpen) return null;

  return (
    <div ref={popoverRef} className="settings-popover" id="settingsPopover" style={style}>
      <div className="settings-category" data-category="appearance">
        <button className="category-header" type="button">
          <svg className="category-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>appearance</span>
        </button>
        <div className="category-content">
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
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="5" />
                      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                  ) : themeId === THEME_IDS.DARK ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="settings-category" data-category="multitab">
        <button className="category-header" type="button">
          <svg className="category-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>Multi-Tab</span>
        </button>
        <div className="category-content">
          <div className="popover-section">
            <div className="popover-row">
              <span className="popover-label-small">Tab Limit</span>
              <input
                type="number"
                id="multiTabLimit"
                min="0"
                max="50"
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
        </div>
      </div>
    </div>
  );
}
