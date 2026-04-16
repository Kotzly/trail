import type { ThemeId } from "@features/themes/model.js";
import { themeCacheItem } from "@shared/config/storage-items.js";

function resolveEffective(theme: ThemeId): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

/**
 * Base shadcn token values for contexts without CSS cascade access
 * (Spotlight Shadow DOM). Matches the :root / .dark definitions in
 * tailwind.css.
 */
const BASE_TOKENS: Record<"light" | "dark", Record<string, string>> = {
  light: {
    "--background": "#ffffff",
    "--foreground": "#09090b",
    "--card": "#ffffff",
    "--card-foreground": "#09090b",
    "--popover": "#ffffff",
    "--popover-foreground": "#09090b",
    "--primary": "#18181b",
    "--primary-foreground": "#fafafa",
    "--secondary": "#f4f4f5",
    "--secondary-foreground": "#18181b",
    "--muted": "#f4f4f5",
    "--muted-foreground": "#71717a",
    "--accent": "#f4f4f5",
    "--accent-foreground": "#18181b",
    "--destructive": "#ef4444",
    "--destructive-foreground": "#fafafa",
    "--border": "#e4e4e7",
    "--input": "#e4e4e7",
    "--ring": "#18181b",
  },
  dark: {
    "--background": "#09090b",
    "--foreground": "#fafafa",
    "--card": "#09090b",
    "--card-foreground": "#fafafa",
    "--popover": "#09090b",
    "--popover-foreground": "#fafafa",
    "--primary": "#fafafa",
    "--primary-foreground": "#18181b",
    "--secondary": "#27272a",
    "--secondary-foreground": "#fafafa",
    "--muted": "#27272a",
    "--muted-foreground": "#a1a1aa",
    "--accent": "#27272a",
    "--accent-foreground": "#fafafa",
    "--destructive": "#ef4444",
    "--destructive-foreground": "#fafafa",
    "--border": "#27272a",
    "--input": "#27272a",
    "--ring": "#d4d4d8",
  },
};

/**
 * Apply base theme tokens as inline styles on a Shadow DOM host.
 * Only needed for elements without access to the CSS cascade
 * (e.g. Spotlight content script Shadow DOM).
 *
 * For the sidepanel, tokens come from the CSS cascade (tailwind.css)
 * and this function is not needed.
 */
export function applyThemeTokens(
  target: HTMLElement,
  theme: ThemeId,
  _customTheme?: unknown,
  opts?: { preserveDefaults?: boolean },
): void {
  const preserveDefaults = opts?.preserveDefaults ?? true;
  if (preserveDefaults) return;

  const effective = resolveEffective(theme);
  const tokens = BASE_TOKENS[effective];
  for (const [key, value] of Object.entries(tokens)) {
    target.style.setProperty(key, value);
  }
}

/**
 * Apply theme to the sidepanel document root.
 *
 * Toggles the `.dark` class on `<html>` — matches the shadcn convention so
 * preset-generated `.dark { ... }` blocks apply cleanly, and keeps the
 * tailwind `@custom-variant dark (&:is(.dark *))` rule firing. The early-apply
 * script does the same thing before React mounts. The user's *choice*
 * ("system" vs explicit) is persisted separately in `trail_settings.theme`.
 *
 * Also sets `color-scheme` so form controls, scrollbars, and the initial
 * paint match the theme.
 */
export function applyTheme(theme: ThemeId): void {
  const root = document.documentElement;
  const effective = resolveEffective(theme);
  root.classList.toggle("dark", effective === "dark");
  root.style.colorScheme = effective;
  void themeCacheItem.setValue(effective);

  try {
    // `trail_theme_choice` stores the user's *pick* (incl. "system") so the
    // next-load early-apply script can re-resolve against the current OS
    // preference. `trail_theme` kept for back-compat with older clients.
    localStorage.setItem("trail_theme_choice", theme);
    localStorage.setItem("trail_theme", effective);
  } catch {
    /* quota / sandboxed */
  }
}
