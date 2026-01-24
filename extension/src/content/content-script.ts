/**
 * Content script for Trail.
 * Tracks title changes for pages that update title dynamically.
 */


type Brand<T, B extends string> = T & { readonly __brand: B};
type Url = Brand<string, "Url">;
type Title = Brand<string, "Title">;
type FaviconUrl = Brand<string, "FaviconUrl">;

type TitleOrFaviconChangedInput = {
  url: Url;
  title?: Title;
  favicon?: FaviconUrl;
}

const MSG_TITLE_OR_FAVICON_CHANGED = 'TITLE_OR_FAVICON_CHANGED' as const;

function notifyTitleOrFaviconChange(payload: TitleOrFaviconChangedInput): void {
  chrome.runtime.sendMessage({ type: MSG_TITLE_OR_FAVICON_CHANGED, ...payload }, () => {
    const err = chrome.runtime.lastError;
    if (!err) return;
    if (err.message?.includes('Receiving end does not exist')) return;
    console.debug('Failed to notify title or favicon change:', err);
  });
}



(function() {
  'use strict';

  

  // todo: perhaps intercept redirects inside the same tab
  /**
   * Track title changes (for pages like YouTube that update title dynamically).
   * Uses MutationObserver to watch the <title> element.
   */
  let lastTitle = document.title;

  function handleTitleChange() {
    const title = document.title as Title;
    if (title && title !== lastTitle) {
      lastTitle = title;
      const url = window.location.href as Url;
      notifyTitleOrFaviconChange({ url, title });
    }
  }

  function getFaviconUrl(): FaviconUrl | undefined {
    const faviconElement = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (faviconElement && faviconElement.href) {
      return faviconElement.href as FaviconUrl;
    }
    return undefined;
  }

  function handleFaviconChange() {
    const favicon = getFaviconUrl();
    if (favicon && favicon !== lastFavicon) {
      lastFavicon = favicon;
      const url = window.location.href as Url;
      notifyTitleOrFaviconChange({ url, favicon });
    }
  }
  
  
  // Observe title element changes
  const titleElement = document.querySelector('title');
  if (titleElement) {
    const titleObserver = new MutationObserver(handleTitleChange);
    
    titleObserver.observe(titleElement, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  // Watch for favicon changes
  let lastFavicon: FaviconUrl | undefined = getFaviconUrl();

  // Observe <head> for changes to favicon links
  const headElement = document.querySelector("head");
  if (headElement) {
    const faviconObserver = new MutationObserver(handleFaviconChange);

    faviconObserver.observe(headElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'rel'],
    });
  }

  let faviconCheckInterval = setInterval(handleFaviconChange, 2000);
  let titleCheckInterval = setInterval(handleTitleChange, 2000);

  setTimeout(() => {
    clearInterval(faviconCheckInterval);
    clearInterval(titleCheckInterval);
  }, 30000);
  
  console.debug('trail content script loaded');
})();
