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
];

const blankUrlPattern = /^about:blank(?:[#?].*)?$/i;
const newTabUrlPatterns: RegExp[] = [
  /^about:newtab/i,
  /^chrome:\/\/newtab/i,
  /^chrome:\/\/new-tab-page/i,
  /^brave:\/\/newtab/i,
  /^edge:\/\/newtab/i,
];
const extensionNewTabPattern = /^chrome-extension:\/\/[^/]+\/.*(newtab|new-tab|ntp)/i;


export function shouldTrackUrl(url: Url): boolean {
  return !ignoredUrlPatterns.some(pattern => pattern.test(url));
}

export function isBlankUrl(url: Url): boolean {
  return blankUrlPattern.test(url);
}

export function isNewTabUrl(url: Url): boolean {
  return newTabUrlPatterns.some(pattern => pattern.test(url)) || extensionNewTabPattern.test(url);
}

export function isPlaceholderUrl(url: Url): boolean {
  return isBlankUrl(url) || isNewTabUrl(url);
}

export function getFaviconUrl(pageUrl: Url, size = 32): FaviconUrl {
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
