import type { FaviconUrl, Url } from "../types/ids.js";
import { runtimeGetURL } from "@shared/platform/webext.js";

/**
 * Build a synthetic favicon URL for a page when no `tab.favIconUrl` is
 * available (cross-tab restores, pinned-trees panel, command palette,
 * etc.).
 *
 * Chrome ships the `chrome-extension://<id>/_favicon/` URL space behind
 * the `favicon` permission — it serves whichever favicon Chrome has
 * cached for that origin, so it works even when the favicon lives at a
 * non-default path. Firefox has no equivalent, so we fall back to the
 * origin's `/favicon.ico` (the legacy default). The `<img>` consumers
 * all use `alt=""`, so failed loads are silent.
 */
export function getFaviconUrl(pageUrl: Url, size = 32): FaviconUrl {
  if (import.meta.env.FIREFOX) {
    try {
      const origin = new URL(pageUrl).origin;
      return `${origin}/favicon.ico` as FaviconUrl;
    } catch {
      return "" as FaviconUrl;
    }
  }
  const url = new URL(runtimeGetURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", String(size));
  return url.toString() as FaviconUrl;
}
