import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useStore } from "../state/store.js";

/**
 * Bridges the persisted `settings.theme` (source of truth, synced across
 * devices) into next-themes, which owns the DOM class toggle and OS-theme
 * listener. Fires once settings arrive, and again whenever the user changes
 * their choice in another surface.
 */
export function useThemeSync(): void {
  const settings = useStore((s) => s.settings);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const next = settings?.theme;
    if (next && next !== theme) setTheme(next);
  }, [settings?.theme, theme, setTheme]);
}
