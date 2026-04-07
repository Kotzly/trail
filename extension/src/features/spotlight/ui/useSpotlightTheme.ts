import { useEffect, useRef } from "react";
import { getSettings } from "./rpc.js";
import { applyThemeTokens } from "@apps/sidepanel/ui/shared/apply-theme.js";
import type { ThemeId } from "@shared/types/theme.js";

/**
 * Resolves a ThemeId ('light' | 'dark' | 'system') to an effective
 * 'light' or 'dark' value suitable for the `data-theme` attribute.
 */
function resolveEffective(themeId: ThemeId): "light" | "dark" {
  if (themeId === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return themeId;
}

/**
 * Synchronizes the Spotlight shadow host's theme with Trail's settings.
 *
 * - Sets `data-theme` attribute (effective light/dark) for CSS overrides
 * - Applies base shadcn tokens as inline styles on the host (the Shadow DOM
 *   has no access to the CSS cascade, so tokens must be set explicitly)
 * - Fetches theme via RPC (safe in content script context)
 * - Watches OS media-query changes for `theme: 'system'`
 */
export function useSpotlightTheme(containerRef: React.RefObject<HTMLElement | null>) {
  const themeIdRef = useRef<ThemeId>("system");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const rootNode = el.getRootNode();
    const host = rootNode instanceof ShadowRoot ? (rootNode.host as HTMLElement) : el;

    const apply = () => {
      const effective = resolveEffective(themeIdRef.current);
      host.setAttribute("data-theme", effective);
      applyThemeTokens(host, effective, null, { preserveDefaults: false });
    };

    // Immediately set based on OS preference (avoids flash before settings load)
    apply();

    // Fetch Trail's actual theme setting via RPC (safe in content script)
    getSettings()
      .then((s) => {
        themeIdRef.current = s.theme;
        apply();
      })
      .catch(() => {
        // Settings unavailable — keep OS-based default with base tokens
      });

    // Re-resolve when OS theme changes (relevant when themeId = 'system')
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => {
      if (themeIdRef.current === "system") apply();
    };
    mql.addEventListener("change", onMediaChange);

    return () => {
      mql.removeEventListener("change", onMediaChange);
    };
  }, [containerRef]);
}
