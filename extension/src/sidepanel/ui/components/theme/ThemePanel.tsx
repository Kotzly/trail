import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Settings, CustomTheme } from '../../../../shared/types/settings.js';
import { saveSettings } from '../../../api/settings.js';
import { useStore } from '../../state/store.js';
import { useOverlayEffects } from '../../state/overlay-effects.js';
import { Icons } from '../Icon.js';
import ThemePalette from './ThemePalette.js';
import { applyTheme } from '../../shared/apply-theme.js';
import React from 'react';

const DEFAULT_THEME: CustomTheme = {
  enabled: false,
  dots: [],
  harmony: 'floating',
  lightness: 50,
  opacity: 0.6,
  texture: 0,
  customColors: [],
  accentColor: null,
};

const withTheme = (settings: Settings | null, next: Partial<Settings>): Settings | null => {
  if (!settings) return null;
  return { ...settings, ...next };
};

export default function ThemePanel() {
  const themePickerOpen = useStore((state) => state.ui.themePickerOpen);
  const setThemePickerOpen = useStore((state) => state.setThemePickerOpen);
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);

  useOverlayEffects(themePickerOpen, { lod: true, blur: true, kind: 'modal' });

  const [draftTheme, setDraftTheme] = useState<CustomTheme>(settings?.customTheme ?? DEFAULT_THEME);
  const pendingSaveRef = useRef<Settings | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const previewRafRef = useRef<number | null>(null);
  const lastPreviewRef = useRef<CustomTheme | null>(null);

  useEffect(() => {
    if (!themePickerOpen) return;
    setDraftTheme(settings?.customTheme ?? DEFAULT_THEME);
  }, [settings?.customTheme, themePickerOpen]);

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const next = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (!next) return;
    try {
      await saveSettings(next);
    } catch (error) {
      console.error('Failed to save theme settings:', error);
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
      }, 240);
    },
    [flushPendingSave]
  );

  useEffect(() => {
    if (!themePickerOpen) {
      void flushPendingSave();
    }
  }, [flushPendingSave, themePickerOpen]);

  const handlePreview = useCallback(
    (nextTheme: CustomTheme) => {
      if (!settings) return;
      lastPreviewRef.current = nextTheme;
      if (previewRafRef.current !== null) {
        cancelAnimationFrame(previewRafRef.current);
      }
      previewRafRef.current = requestAnimationFrame(() => {
        applyTheme(settings.theme, nextTheme);
      });
    },
    [settings]
  );

  const handleCommit = useCallback(
    (nextTheme: CustomTheme) => {
      if (!settings) return;
      const nextSettings = withTheme(settings, { customTheme: nextTheme });
      if (!nextSettings) return;
      lastPreviewRef.current = null;
      setDraftTheme(nextTheme);
      setSettings(nextSettings);
      applyTheme(nextSettings.theme, nextTheme);
      scheduleSave(nextSettings);
    },
    [scheduleSave, setSettings, settings]
  );

  const handleSchemeChange = useCallback(
    (nextScheme: Settings['theme']) => {
      if (!settings) return;
      const nextSettings = withTheme(settings, { theme: nextScheme });
      if (!nextSettings) return;
      setSettings(nextSettings);
      applyTheme(nextScheme, nextSettings.customTheme);
      scheduleSave(nextSettings);
    },
    [scheduleSave, setSettings, settings]
  );

  const handleClose = useCallback(() => {
    if (lastPreviewRef.current) {
      handleCommit(lastPreviewRef.current);
    }
    setThemePickerOpen(false);
  }, [handleCommit, setThemePickerOpen]);

  useEffect(() => {
    if (!themePickerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [handleClose, themePickerOpen]);

  if (!themePickerOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="theme-panel-overlay lod-enabler blur-enabler" onClick={handleClose}>
      <div
        className="theme-panel"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="theme-panel-header">
          <div>
            <div className="theme-panel-title">Theme</div>
            <div className="theme-panel-subtitle">Pick a palette for the whole UI.</div>
          </div>
          <button
            className="theme-panel-close"
            type="button"
            onClick={handleClose}
            aria-label="Close theme picker"
          >
            <Icons.X size={18} />
          </button>
        </div>
        <ThemePalette
          scheme={settings?.theme ?? 'system'}
          value={draftTheme}
          onSchemeChange={handleSchemeChange}
          onPreview={handlePreview}
          onCommit={handleCommit}
        />
      </div>
    </div>,
    document.body
  );
}
