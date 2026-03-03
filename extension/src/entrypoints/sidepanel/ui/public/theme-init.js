// This file intentionally uses raw chrome.storage.local instead of WXT storage.
// It is vanilla JS (not a module), runs before React hydration to prevent
// a theme flash, and cannot import from 'wxt/utils/storage'.
(function () {
  var root = document.documentElement;
  // Fast path: use cached value to avoid visible theme flash.
  var cached = sessionStorage.getItem('trail-theme-cache');
  if (cached) {
    root.setAttribute('data-theme', cached);
  }
  // Validate against chrome.storage (source of truth).
  chrome.storage.local.get('trail_settings').then(function (r) {
    var t = r.trail_settings && r.trail_settings.theme;
    if (t) {
      root.setAttribute('data-theme', t);
      sessionStorage.setItem('trail-theme-cache', t);
    } else if (!cached) {
      root.setAttribute('data-theme', 'system');
    }
  });
})();
