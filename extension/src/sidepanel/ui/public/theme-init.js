chrome.storage.local.get('trail_settings').then(function (r) {
  var t = r.trail_settings && r.trail_settings.theme;
  if (t) {
    document.documentElement.setAttribute('data-theme', t);
    if (t === 'dark') document.body.style.background = '#111218';
    else if (t === 'light') document.body.style.background = '#f8f9fb';
  } else {
    document.documentElement.setAttribute('data-theme', 'system');
  }
});
