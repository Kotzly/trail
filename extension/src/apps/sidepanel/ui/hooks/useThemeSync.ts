import { useEffect } from "react";
import { useTheme } from "next-themes";
import type { ThemeId } from "@shared/types/theme.js";

/**
 * Bridges the persisted `settings.theme` (source of truth, synced across
 * devices) into next-themes, which owns the DOM class toggle and OS-theme
 * listener. Fires once settings arrive, and again whenever the user changes
 * their choice in another surface.
 */
export function useThemeSync(theme: ThemeId | undefined): void {
  const { theme: ntTheme, setTheme } = useTheme();

  useEffect(() => {
    if (theme && theme !== ntTheme) setTheme(theme);
  }, [theme, ntTheme, setTheme]);
}
