import { useEffect } from "react";

const STORAGE_KEY = "trail_theme_preset";
const ATTRIBUTE = "data-theme";

export function useThemePresetSync(presetId: string | undefined): void {
  useEffect(() => {
    const root = document.documentElement;
    if (!presetId || presetId === "default") {
      root.removeAttribute(ATTRIBUTE);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // sandboxed
      }
      return;
    }
    root.setAttribute(ATTRIBUTE, presetId);
    try {
      localStorage.setItem(STORAGE_KEY, presetId);
    } catch {
      // sandboxed
    }
  }, [presetId]);
}
