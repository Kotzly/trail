// Prevent white flash: apply background before CSS module loads.
// This file MUST be a plain .js file (not .ts) loaded via <script src="...">
// because Chrome MV3 CSP blocks inline scripts.
(function () {
  var t;
  try { t = localStorage.getItem('trail_theme'); } catch (e) { /* noop */ }
  if (!t) try { t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { /* noop */ }
  if (t) {
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.backgroundColor = t === 'dark' ? '#09090b' : '#fff';
    document.documentElement.style.colorScheme = t;
  }
})();
