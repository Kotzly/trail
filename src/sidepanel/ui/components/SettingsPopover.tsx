import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import type { Settings } from '../../../shared/types/settings.js';
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
  );
}
