/**
 * Content script for Trail.
 * In single-tab mode: intercepts target="_blank" links to open in same tab.
 * In multi-tab mode: lets links open naturally in new tabs.
 */

(function() {
  'use strict';

  // Cache for multi-tab mode setting
  let isMultiTabMode = false;

  /**
   * Check multi-tab mode setting.
   */
  async function checkMultiTabMode() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response?.success) {
        isMultiTabMode = response.settings?.multiTabEnabled || false;
      }
    } catch (e) {
      // Extension context may be invalidated
    }
  }

  // Check mode on load
  checkMultiTabMode();

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.settings) {
      isMultiTabMode = changes.settings.newValue?.multiTabEnabled || false;
    }
  });

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
   * In multi-tab mode: don't intercept, let browser handle naturally.
   * In single-tab mode: intercept and navigate in same tab.
   */
  function handleLinkClick(event) {
    // In multi-tab mode, don't intercept anything
    if (isMultiTabMode) return;

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
   * In multi-tab mode: don't intercept.
   */
  function handleAuxClick(event) {
    // In multi-tab mode, don't intercept
    if (isMultiTabMode) return;

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

  // Also intercept window.open calls (only in single-tab mode)
  const originalOpen = window.open;
  window.open = function(url, target, features) {
    // In multi-tab mode, let browser handle normally
    if (isMultiTabMode) {
      return originalOpen.call(this, url, target, features);
    }
    
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

  /**
   * Track title changes (for pages like YouTube that update title dynamically).
   * Uses MutationObserver to watch the <title> element.
   */
  let lastTitle = document.title;
  
  function notifyTitleChange(newTitle) {
    chrome.runtime.sendMessage({
      type: 'TITLE_CHANGED',
      url: window.location.href,
      title: newTitle
    }).catch(() => {
      // Extension context may be invalidated, ignore
    });
  }
  
  // Observe title element changes
  const titleElement = document.querySelector('title');
  if (titleElement) {
    const titleObserver = new MutationObserver(() => {
      const newTitle = document.title;
      if (newTitle && newTitle !== lastTitle) {
        lastTitle = newTitle;
        notifyTitleChange(newTitle);
      }
    });
    
    titleObserver.observe(titleElement, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }
  
  // Also check periodically for pages that set title via JS
  // without modifying the <title> element directly
  let titleCheckInterval = setInterval(() => {
    const newTitle = document.title;
    if (newTitle && newTitle !== lastTitle) {
      lastTitle = newTitle;
      notifyTitleChange(newTitle);
    }
  }, 2000);
  
  // Stop checking after 30 seconds (most pages have stable titles by then)
  setTimeout(() => {
    clearInterval(titleCheckInterval);
  }, 30000);

  console.debug('Stack History: Content script loaded');
})();
