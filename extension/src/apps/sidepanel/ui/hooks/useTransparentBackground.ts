import { useEffect } from "react";

const ATTRIBUTE = "data-zen-glass";

/**
 * Opt-in "Transparent background" (Firefox/Zen). Toggles the `data-zen-glass`
 * attribute on <html>, which the glass-mode CSS in sidepanel.css keys off to
 * make the panel backdrop transparent so Zen's themed sidebar / workspace
 * gradient shows through behind the tree. Only the empty backdrop goes
 * transparent — node cards, panels and controls keep their own surfaces and
 * still follow the active light/dark theme. Decoupled from the color preset so
 * transparency is never forced. See settings.transparentBackground.
 */
export function useTransparentBackground(enabled: boolean | undefined): void {
  useEffect(() => {
    const root = document.documentElement;
    if (enabled) root.setAttribute(ATTRIBUTE, "");
    else root.removeAttribute(ATTRIBUTE);
    return () => root.removeAttribute(ATTRIBUTE);
  }, [enabled]);
}
