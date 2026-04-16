// Prevent white flash: apply background before CSS module loads.
// This file MUST be a plain .js file (not .ts) loaded via <script src="...">
// because Chrome MV3 CSP blocks inline scripts.
//
// Two localStorage keys:
//   trail_theme_choice — the user's PICK ("system" | "light" | "dark")
//                        set by applyTheme() when user changes theme
//   trail_theme        — the RESOLVED theme actually in effect (back-compat)
(function () {
  var choice;
  try {
    choice = localStorage.getItem("trail_theme_choice") || localStorage.getItem("trail_theme");
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
  root.setAttribute("data-theme", resolved);
  root.style.backgroundColor = resolved === "dark" ? "#09090b" : "#ffffff";
  root.style.colorScheme = resolved;
})();
