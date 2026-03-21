import type { FaviconUrl, Url } from "../types/ids.js";
import { runtimeGetURL } from "@shared/platform/webext.js";

export function getFaviconUrl(pageUrl: Url, size = 32): FaviconUrl {
  const url = new URL(runtimeGetURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", String(size));
  return url.toString() as FaviconUrl;
}
