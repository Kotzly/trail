import type { FaviconUrl, Url } from '../../shared/types/ids.js';
import { getFaviconUrl } from '../../shared/utils/favicon.js';
export { getFaviconUrl };

const ignoredUrlPatterns: RegExp[] = [
  /^devtools:/,
  /^javascript:/,
  /^mailto:/,
  /^tel:/,
  /^data:/,
  /^chrome-extension:/,
]

const blockedFaviconUrlPatterns: RegExp[] = [
  /^chrome:\/\/favicon2/i,
  /^chrome:\/\/favicon\//i,
  /^chrome:\/\/favicon\?/i,
  /^chrome-extension:\/\/[^/]+\/_favicon\//i,
  /^about:blank(?:[#?].*)?$/i,
];


const ntpUrlPatterns: ReadonlyArray<RegExp> = [
  /^(?<scheme>[a-z][a-z0-9+.-]*):\/\/(?<page>newtab|new-tab-page)\/?(?:[?#].*)?$/i,
  /^(?<scheme>chrome-search):\/\/(?<page>local-ntp|newtab)\/.*$/i,
  /^(?<scheme>chrome-extension):\/\/(?<extId>[a-p]{32})\/(?<path>(?:.*\/)?(?:newtab|new-tab-page|ntp)(?:\.html?)?)(?:[?#].*)?$/i,
  /^(?<scheme>brave-extension):\/\/(?<extId>[a-p]{32})\/(?<path>(?:.*\/)?(?:newtab|new-tab-page|ntp)(?:\.html?)?)(?:[?#].*)?$/i,
  /^about:blank(?:[#?].*)?$/i,
  /^about:newtab(?:[#?].*)?$/i,
  /^about:new-tab-page(?:[#?].*)?$/i,
  /^about:ntp(?:[#?].*)?$/i,
] as const;

export function isNewTabUrl(url: Url): boolean {
  return ntpUrlPatterns.some((pattern) => pattern.test(url));
}

export function isNewTabContext(url: Url, title?: string | null): boolean {
  if (isNewTabUrl(url)) return true;
  if (!title) return false;
  return title.toLowerCase().includes('new tab');
}


export function shouldTrackUrl(url: Url): boolean {
  return !ignoredUrlPatterns.some(pattern => pattern.test(url));
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
