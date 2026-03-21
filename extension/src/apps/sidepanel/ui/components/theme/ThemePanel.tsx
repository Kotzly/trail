import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Settings, CustomTheme } from "@shared/types/settings.js";
import { saveSettings } from "../../../api/settings.js";
import { useStore } from "../../state/store.js";
import { useOverlayEffects } from "../../state/overlay-effects.js";
import { cn } from "../../lib/utils.js";
import ThemePalette from "./ThemePalette.js";
import { applyTheme } from "../../shared/apply-theme.js";

const DEFAULT_THEME: CustomTheme = {
  enabled: false,
  dots: [],
  harmony: "floating",
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

  const [isMounted, setIsMounted] = useState(themePickerOpen);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useOverlayEffects(isMounted, { lod: true, blur: true, kind: "modal" });

  const [draftTheme, setDraftTheme] = useState<CustomTheme>(settings?.customTheme ?? DEFAULT_THEME);
  const pendingSaveRef = useRef<Settings | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const previewRafRef = useRef<number | null>(null);
  const lastPreviewRef = useRef<CustomTheme | null>(null);

  useEffect(() => {
    if (themePickerOpen) {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- state sync on dep change
      setIsMounted(true);
      setIsClosing(false);
      return;
    }
    if (!isMounted) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setIsMounted(false);
      setIsClosing(false);
      closeTimerRef.current = null;
    }, 180);
  }, [isMounted, themePickerOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!themePickerOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state sync on dep change
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
      console.error("Failed to save theme settings:", error);
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
    [flushPendingSave],
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
    [settings],
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
    [scheduleSave, setSettings, settings],
  );

  const handleSchemeChange = useCallback(
    (nextScheme: Settings["theme"]) => {
      if (!settings) return;
      const nextSettings = withTheme(settings, { theme: nextScheme });
      if (!nextSettings) return;
      setSettings(nextSettings);
      applyTheme(nextScheme, nextSettings.customTheme);
      scheduleSave(nextSettings);
    },
    [scheduleSave, setSettings, settings],
  );

  const handleClose = useCallback(() => {
    if (lastPreviewRef.current) {
      handleCommit(lastPreviewRef.current);
    }
    setThemePickerOpen(false);
  }, [handleCommit, setThemePickerOpen]);

  useEffect(() => {
    if (!isMounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [handleClose, isMounted]);

  if (!isMounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn("modal-overlay theme-panel-overlay lod-enabler blur-enabler", isClosing && "closing")}
      onClick={handleClose}
    >
      <div
        className={cn("theme-panel", isClosing && "closing")}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <ThemePalette
          scheme={settings?.theme ?? "system"}
          value={draftTheme}
          onSchemeChange={handleSchemeChange}
          onPreview={handlePreview}
          onCommit={handleCommit}
        />
      </div>
    </div>,
    document.body,
  );
}
