(function () {
  var root = document.documentElement;
  // Synchronous path: read cached theme from sessionStorage (instant, no FOUC)
  var cached = sessionStorage.getItem('trail-theme-cache');
  if (cached) {
    root.setAttribute('data-theme', cached);
  }
  // Async path: validate against chrome.storage (source of truth)
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
