import { useEffect } from "react";

/**
 * Drops button focus when the sidepanel window loses focus (e.g. user
 * switches the active browser tab). Without this, returning to the panel
 * trips Chromium's `:focus-visible` heuristic on whichever button was last
 * clicked and Radix Tooltip re-shows its bubble on focus — manifesting as
 * a stray ring + tooltip on Undo / Pin / etc. for a frame or two.
 *
 * Limited to `<button>` so we don't clobber legitimate input focus
 * (search field, rename dialog) — losing typed text on tab switch would
 * be a worse bug than the flash this fixes.
 */
export function useClearButtonFocusOnBlur(): void {
  useEffect(() => {
    const handleBlur = () => {
      const el = document.activeElement;
      if (el instanceof HTMLButtonElement) el.blur();
    };
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);
}
