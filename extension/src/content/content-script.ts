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
const MSG_OPEN_PANEL = 'OPEN_PANEL' as const;

const SITE_MESSAGE_SOURCE = 'trail-site' as const;
const EXTENSION_MESSAGE_SOURCE = 'trail-extension' as const;
const OPEN_TRAIL_PANEL = 'OPEN_TRAIL_PANEL' as const;
const OPEN_TRAIL_PANEL_ACK = 'OPEN_TRAIL_PANEL_ACK' as const;
const OPEN_PANEL_ATTR = 'data-trail-open-panel' as const;
const OPEN_PANEL_REQUEST_ID_ATTR = 'data-trail-request-id' as const;

const ALLOWED_ORIGINS = new Set([
  'https://gettrail.net',
  'https://app.gettrail.net',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
]);

function notifyTitleOrFaviconChange(payload: TitleOrFaviconChangedInput): void {
  chrome.runtime.sendMessage({ type: MSG_TITLE_OR_FAVICON_CHANGED, ...payload }, () => {
    const err = chrome.runtime.lastError;
    if (!err) return;
    if (err.message?.includes('Receiving end does not exist')) return;
    console.debug('Failed to notify title or favicon change:', err);
  });
}

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function postOpenPanelAck(requestId: string, origin: string, ok: boolean, error?: string): void {
  if (!requestId) return;
  window.postMessage(
    {
      source: EXTENSION_MESSAGE_SOURCE,
      type: OPEN_TRAIL_PANEL_ACK,
      requestId,
      ok,
      error,
    },
    origin
  );
}

function requestOpenPanel(requestId: string, origin: string): void {
  if (!chrome?.runtime?.id) {
    postOpenPanelAck(requestId, origin, false, 'Extension runtime unavailable');
    return;
  }

  try {
    chrome.runtime.sendMessage({ type: MSG_OPEN_PANEL }, (response) => {
      const err = chrome.runtime.lastError;
      const responseOk =
        Boolean(response && typeof response === 'object' && 'success' in response)
          ? Boolean((response as { success?: boolean }).success)
          : true;
      const errorMessage =
        err?.message ||
        (response && typeof response === 'object' && 'success' in response && !(response as { success?: boolean }).success
          ? (response as { error?: string }).error || 'Failed to open side panel'
          : undefined);
      postOpenPanelAck(requestId, origin, !err && responseOk, errorMessage);
    });
  } catch (error) {
    postOpenPanelAck(
      requestId,
      origin,
      false,
      error instanceof Error ? error.message : 'Failed to open side panel'
    );
  }
}

function handleOpenPanelRequest(event: MessageEvent): void {
  if (event.source !== window) return;
  if (!isAllowedOrigin(event.origin)) return;

  const data = event.data as { source?: string; type?: string; requestId?: string } | null;
  if (!data || data.source !== SITE_MESSAGE_SOURCE || data.type !== OPEN_TRAIL_PANEL) return;

  const requestId = typeof data.requestId === 'string' ? data.requestId : '';

  requestOpenPanel(requestId, event.origin);
}

function handleOpenPanelClick(event: MouseEvent): void {
  if (!event.isTrusted) return;
  if (!isAllowedOrigin(window.location.origin)) return;

  const target = event.target;
  if (!(target instanceof Element)) return;

  const trigger = target.closest(`[${OPEN_PANEL_ATTR}]`);
  if (!trigger) return;

  const requestId = trigger.getAttribute(OPEN_PANEL_REQUEST_ID_ATTR) ?? '';
  requestOpenPanel(requestId, window.location.origin);
}



(function() {
  'use strict';

  window.addEventListener('message', handleOpenPanelRequest);
  document.addEventListener('click', handleOpenPanelClick, true);

  

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
