import type { FaviconUrl, Url } from '../../shared/types/ids.js';

const ignoredUrlPatterns: RegExp[] = []

const blockedFaviconUrlPatterns: RegExp[] = [
  /^chrome:\/\/favicon2/i,
  /^chrome:\/\/favicon\//i,
  /^chrome:\/\/favicon\?/i,
];

/*[
  /^chrome:/,
  /^chrome-extension:/,
  /^brave:/,
  /^about:/,
  /^javascript:/,
  /^mailto:/,
  /^tel:/,
  /^data:/,
  /^moz-extension:/,
  /^edge:/,
];
*/

// const ignoredFaviconPatterns: RegExp[] = [
//   /^chrome:/,
//   /^chrome-extension:/,
//   /^brave:/,
//   /^about:/,
//   /^javascript:/,
//   /^mailto:/,
//   /^tel:/,
//   /^data:/,
//   /^moz-extension:/,
//   /^edge:/,
//   /^moz-extension:/,
// ];

/**
 * Check if a URL should be tracked.
 */
export function shouldTrackUrl(url: Url): boolean {
  return !ignoredUrlPatterns.some(pattern => pattern.test(url));
}

/**
 * Get favicon URL for a given URL.
 */
export function getFaviconUrl(pageUrl: Url, size = 32): FaviconUrl {
  console.debug("getFaviconUrlCalled")
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", String(size));
  return url.toString() as FaviconUrl;
}

export function normalizeFaviconUrl(
  pageUrl: Url | null | undefined,
  faviconUrl?: string | null
): FaviconUrl | undefined {
  if (faviconUrl && !blockedFaviconUrlPatterns.some(pattern => pattern.test(faviconUrl))) {
    return faviconUrl as FaviconUrl;
  }
  if (pageUrl) {
    return getFaviconUrl(pageUrl);
  }
  return undefined;
}
