import type { FaviconUrl, Url } from '../../shared/types/ids.js';

const ignoredUrlPatterns: RegExp[] = [
  /^devtools:/,
  /^javascript:/,
  /^mailto:/,
  /^tel:/,
  /^data:/,
  /^about:blank(?:[#?].*)?$/i,
]

const blockedFaviconUrlPatterns: RegExp[] = [
  /^chrome:\/\/favicon2/i,
  /^chrome:\/\/favicon\//i,
  /^chrome:\/\/favicon\?/i,
  /^chrome-extension:\/\/[^/]+\/_favicon\//i,
];

// const newTabUrlPatterns: RegExp[] = [
//   /^about:newtab/i,
//   /^chrome:\/\/newtab/i,
//   /^chrome:\/\/new-tab-page/i,
//   /^brave:\/\/newtab/i,
//   /^edge:\/\/newtab/i,
//   /^chrome-extension:\/\/[^/]+\/.*(newtab|new-tab|ntp)/i,
// ];


export function shouldTrackUrl(url?: Url): boolean {
  if (!url) return false;
  return !ignoredUrlPatterns.some(pattern => pattern.test(url));
}

// export function isNewTabUrl(url: Url): boolean {
//   return newTabUrlPatterns.some(pattern => pattern.test(url));
// }


export function getFaviconUrl(pageUrl: Url, size = 32): FaviconUrl {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", String(size));
  return url.toString() as FaviconUrl;
}

export function normalizeFaviconUrl(
  pageUrl: Url,
  faviconUrl?: FaviconUrl
): FaviconUrl | undefined {
  if (faviconUrl && !blockedFaviconUrlPatterns.some(pattern => pattern.test(faviconUrl))) {
    return faviconUrl as FaviconUrl;
  }
  if (pageUrl) {
    return getFaviconUrl(pageUrl);
  }
  console.warn('No favicon URL found for page URL', pageUrl);
  return undefined;
}
