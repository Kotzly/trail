import type { FaviconUrl, Url } from '../types/ids.js';

export function getFaviconUrl(pageUrl: Url, size = 32): FaviconUrl {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", String(size));
  return url.toString() as FaviconUrl;
}
