import type { FaviconUrl, Url } from '../../shared/types/ids.js';

const ignoredUrlPatterns: RegExp[] = [
  /^devtools:/,
  /^javascript:/,
  /^mailto:/,
  /^tel:/,
  /^data:/,
]

const blockedFaviconUrlPatterns: RegExp[] = [
  /^chrome:\/\/favicon2/i,
  /^chrome:\/\/favicon\//i,
  /^chrome:\/\/favicon\?/i,
  /^chrome-extension:\/\/[^/]+\/_favicon\//i,
  /^about:blank(?:[#?].*)?$/i,
];




export function shouldTrackUrl(url: Url): boolean {
  return !ignoredUrlPatterns.some(pattern => pattern.test(url));
}

export function getFaviconUrl(pageUrl: Url, size = 32): FaviconUrl {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", String(size));
  return url.toString() as FaviconUrl;
}

export function normalizeFaviconUrl(
  pageUrl: Url | null | undefined,
  faviconUrl?: FaviconUrl | null
): FaviconUrl | undefined {
  if (faviconUrl && !blockedFaviconUrlPatterns.some(pattern => pattern.test(faviconUrl))) {
    return faviconUrl as FaviconUrl;
  }
  if (pageUrl) {
    return getFaviconUrl(pageUrl);
  }
  return undefined;
}
