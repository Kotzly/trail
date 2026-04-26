// FOUC-prevention for next-themes under MV3 CSP.
//
// React theming is handled by next-themes (see ui/providers/theme-provider.tsx).
// next-themes normally injects its anti-flash snippet via
// `<script dangerouslySetInnerHTML>`, but MV3 extension pages forbid inline
// scripts, so we ship the equivalent as an external .js loaded synchronously
// from the HTML <head>.
//
// If you change the storageKey on <ThemeProvider>, update it here too.
//
// localStorage keys:
//   trail_theme_choice — user's PICK ("system" | "light" | "dark")
//                        written by next-themes when the user changes theme
//   trail_theme        — legacy RESOLVED theme (back-compat)
//   trail_theme_preset — color palette preset id (e.g. "catppuccin"); absent
//                        means "default" (no override). Mirrored by
//                        useThemePresetSync; consumed here to set
//                        data-theme on <html> before CSS paints.
(function () {
  var choice;
  var preset;
  try {
    choice = localStorage.getItem("trail_theme_choice") || localStorage.getItem("trail_theme");
    preset = localStorage.getItem("trail_theme_preset");
  } catch (e) {
    /* sandboxed */
  }
  var resolved;
  if (choice === "light" || choice === "dark") {
    resolved = choice;
  } else {
    try {
      resolved = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch (e) {
      resolved = "light";
    }
  }
  var root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  if (preset && preset !== "default") root.setAttribute("data-theme", preset);
  root.style.backgroundColor = resolved === "dark" ? "#09090b" : "#ffffff";
  root.style.colorScheme = resolved;
})();
