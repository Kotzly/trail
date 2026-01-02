/**
 * Content script for Stack History.
 * Intercepts target="_blank" links to open in same tab.
 */

(function() {
  'use strict';

  /**
   * Check if URL should be intercepted (not internal browser URLs).
   */
  function shouldIntercept(url) {
    if (!url) return false;
    const ignoredPatterns = [
      /^chrome:/,
      /^chrome-extension:/,
      /^brave:/,
      /^about:/,
      /^javascript:/,
      /^mailto:/,
      /^tel:/,
      /^data:/
    ];
    return !ignoredPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Handle click on links with target="_blank" or middle-click.
   */
  function handleLinkClick(event) {
    // Skip if modifier keys are pressed (user wants new tab)
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    // Find the closest anchor element
    let target = event.target;
    while (target && target.tagName !== 'A') {
      target = target.parentElement;
    }

    if (!target || target.tagName !== 'A') return;

    const href = target.href;
    const linkTarget = target.target;

    // Only intercept if it would open in a new tab
    if (linkTarget === '_blank' && shouldIntercept(href)) {
      event.preventDefault();
      event.stopPropagation();
      
      // Navigate in the same tab
      window.location.href = href;
    }
  }

  /**
   * Handle middle-click to prevent opening in new tab.
   */
  function handleAuxClick(event) {
    // Middle-click (button 1)
    if (event.button !== 1) return;

    let target = event.target;
    while (target && target.tagName !== 'A') {
      target = target.parentElement;
    }

    if (!target || target.tagName !== 'A') return;

    const href = target.href;
    if (shouldIntercept(href)) {
      event.preventDefault();
      event.stopPropagation();
      
      // Navigate in the same tab
      window.location.href = href;
    }
  }

  // Use capturing phase to intercept before other handlers
  document.addEventListener('click', handleLinkClick, true);
  document.addEventListener('auxclick', handleAuxClick, true);

  // Also intercept window.open calls
  const originalOpen = window.open;
  window.open = function(url, target, features) {
    if (url && shouldIntercept(url)) {
      // Navigate in the same tab instead of opening new one
      window.location.href = url;
      return null;
    }
    return originalOpen.call(this, url, target, features);
  };

  /**
   * Track hash changes (for SPA like Gmail that use hash routing).
   * webNavigation API doesn't fire for hash-only changes.
   */
  let lastUrl = window.location.href;

  function notifyUrlChange(newUrl, isHashOnly = false, isBackForward = false) {
    chrome.runtime.sendMessage({
      type: 'URL_CHANGED',
      url: newUrl,
      title: document.title,
      isHashOnly: isHashOnly,
      isBackForward: isBackForward
    }).catch(() => {
      // Extension context may be invalidated, ignore
    });
  }

  // Listen for hashchange events
  window.addEventListener('hashchange', (event) => {
    const newUrl = window.location.href;
    if (newUrl !== lastUrl) {
      lastUrl = newUrl;
      notifyUrlChange(newUrl, true);
    }
  });

  // Also track popstate for hash changes via back/forward
  window.addEventListener('popstate', () => {
    const newUrl = window.location.href;
    if (newUrl !== lastUrl) {
      lastUrl = newUrl;
      notifyUrlChange(newUrl, false, true);
    }
  });

  // Track initial page with hash
  if (window.location.hash) {
    // Delay to let the page title load
    setTimeout(() => {
      notifyUrlChange(window.location.href, true);
    }, 500);
  }

  console.debug('Stack History: Content script loaded');
})();
