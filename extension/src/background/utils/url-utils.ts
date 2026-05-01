import type { FaviconUrl, Url } from "@shared/types/ids.js";
import { getFaviconUrl } from "@shared/utils/favicon.js";
import { compileBlocklist, type UrlPredicate } from "@shared/lib/url-blocklist.js";
import { isNewTabUrl } from "@shared/lib/root.js";
import { browser } from "@shared/platform/webext.js";
export { getFaviconUrl };
export { isNewTabUrl };

/**
 * True iff `url` is one of OUR extension's own pages
 * (`chrome-extension://${runtime.id}/...`). These are the extension's
 * internal UI — settings, sidepanel, popup, onboarding — not user
 * navigation, so they must never appear in the tree, must never get a
 * tab→node mapping, and must never be promoted to "current".
 *
 * This is a stronger filter than `shouldTrackUrl` (which is gated by
 * the user-configured scheme allowlist). Users can opt into tracking
 * `chrome-extension:` for OTHER extensions' pages without our own
 * leaking through.
 *
 * Also used to interpret transient tab states where Chrome reports an
 * empty `tab.url` but a `tab.pendingUrl` that already targets our
 * extension — the activation race that previously surfaced settings
 * as "current = New Tab".
 */
export function isOwnExtensionUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const id = browser.runtime?.id;
  if (!id) return false;
  return url.startsWith(`chrome-extension://${id}/`);
}

const blockedFaviconUrlPatterns: RegExp[] = [
  /^chrome:\/\/favicon2/i,
  /^chrome:\/\/favicon\//i,
  /^chrome:\/\/favicon\?/i,
  /^chrome-extension:\/\/[^/]+\/_favicon\//i,
  /^about:blank(?:[#?].*)?$/i,
];

/**
 * Detect new-tab / NTP contexts strictly by URL pattern. The old
 * implementation also matched any tab whose title (case-insensitively)
 * contained "new tab" — but this produced false positives on real
 * pages (Stack Overflow threads, Notion pages, Google Chrome Help,
 * etc. whose title contains "New Tab…"). Those pages were silently
 * routed to the tree's root node instead of being tracked normally.
 *
 * The `title` parameter is kept for API compatibility but deliberately
 * unused; removing it would churn ~10 call sites. Flagged as _title
 * to signal its vestigial status.
 */
export function isNewTabContext(url: Url, _title?: string | null): boolean {
  return isNewTabUrl(url);
}

// Cached scheme allowlist. Populated from settings; defaults to
// http(s) so events arriving before settings load don't silently
// track chrome-extension:// or similar.
let cachedSchemes = new Set<string>(["http:", "https:"]);

export function setTrackedSchemes(schemes: readonly string[]): void {
  // No fallback if user clears the list — an explicit empty list means
  // "track nothing", and settings/url-utils/UI copy all agree on that.
  // The module-scope initializer above handles the startup race where
  // events fire before settings load.
  const normalized = schemes
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
    .map((s) => (s.endsWith(":") ? s : `${s}:`));
  cachedSchemes = new Set(normalized);
}

/** Allowlist: URL scheme must be in the user-configured set. */
export function isTrackableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return cachedSchemes.has(parsed.protocol);
  } catch {
    return false;
  }
}

// Cache the compiled blocklist — settings write frequency is low and
// navigation frequency is high. The default is a "block everything"
// predicate so any navigation event arriving before settings load
// falls into the blocked branch. Callers that can wait should await
// `settingsManager.ready` first; fire-and-forget callers get a safe
// default-deny instead of a silent privacy leak.
let cachedBlocklistKey = "";
let cachedBlocklist: UrlPredicate = () => true;
let blocklistReady = false;

export function setUrlBlocklist(patterns: readonly string[]): void {
  // Canonicalize the cache key: sort + escape the delimiter so
  // (a) pattern reordering doesn't cause a pointless recompile, and
  // (b) pathological patterns like ["a\nb"] can't collide with
  // ["a", "b"] (#97).
  const sorted = [...patterns].map((p) => p.replace(/[\\|]/g, (m) => `\\${m}`)).sort();
  const key = sorted.join("|");
  if (blocklistReady && key === cachedBlocklistKey) return;
  cachedBlocklistKey = key;
  cachedBlocklist = compileBlocklist(patterns);
  blocklistReady = true;
}

export function isBlocklistReady(): boolean {
  return blocklistReady;
}

/**
 * URLs that are never tracked, never create a node, never mutate
 * anything — bot-challenge, captcha, and similar interstitials that
 * the user didn't intend to visit.
 *
 * Matching one of these means: handler returns early, tree untouched,
 * tab→node mapping preserved on whatever was previously loaded. When
 * the challenge resolves and the real destination loads, that
 * destination URL flows through normally and matches its prior node.
 *
 * Not configurable at runtime (yet) — the list is small, site-wide,
 * and adding to it is a fast-follow. If user needs per-site opt-out,
 * `settings.privacy.blocklist` already covers that path.
 */
const challengeUrlPatterns: ReadonlyArray<RegExp> = [
  // Google's bot detection / "Our systems have detected unusual traffic"
  /^https?:\/\/(?:[^/]+\.)?google\.[a-z.]+\/sorry(?:\/|$)/i,
  // Cloudflare Under Attack / Turnstile challenge shell
  /^https?:\/\/[^/]+\/cdn-cgi\/challenge-platform\//i,
  /^https?:\/\/challenges\.cloudflare\.com\//i,
  // hCaptcha iframe host
  /^https?:\/\/(?:newassets\.)?hcaptcha\.com\//i,
  // reCAPTCHA iframe host (normally loaded in iframe but some pages redirect)
  /^https?:\/\/www\.google\.com\/recaptcha\/api2\/bframe/i,
  // Akamai bot manager challenge
  /^https?:\/\/[^/]+\/_Incapsula_Resource\?/i,
  // DataDome
  /^https?:\/\/geo\.captcha-delivery\.com\//i,
] as const;

export function isChallengeUrl(url: Url | string): boolean {
  return challengeUrlPatterns.some((pattern) => pattern.test(url));
}

export function shouldTrackUrl(url: Url): boolean {
  if (isChallengeUrl(url)) return false;
  if (!isTrackableUrl(url)) return false;
  return !cachedBlocklist(url);
}

export function normalizeFaviconUrl(
  pageUrl: Url | null | undefined,
  faviconUrl?: FaviconUrl | null,
): FaviconUrl | undefined {
  if (faviconUrl && !blockedFaviconUrlPatterns.some((pattern) => pattern.test(faviconUrl))) {
    return faviconUrl as FaviconUrl;
  }
  if (pageUrl) {
    return getFaviconUrl(pageUrl);
  }
  return undefined;
}
