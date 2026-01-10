import type { FaviconUrl, Url } from '../../shared/types/ids.js';

const ignoredUrlPatterns: RegExp[] = [
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

const ignoredFaviconPatterns: RegExp[] = [
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
  /^moz-extension:/,
];

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
  return `chrome://favicon2/?page_url=${encodeURIComponent(pageUrl)}&size=${size}` as FaviconUrl;
}
