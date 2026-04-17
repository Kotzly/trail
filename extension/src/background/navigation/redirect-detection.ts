import { createUrlKey } from "@shared/lib/url-key.js";
import type { NodeId, TabId, Url, UrlWithTimestamp } from "@shared/types/ids.js";

/**
 * Per-tab URL history used for round-trip detection (A → B → A).
 *
 * When the user hops from A → B → A (quick glance at a linked page,
 * clicking back), the return leg matches an entry in the tab's
 * history. We detect this by URL-key equality over a bounded window,
 * so the detection is dwell-time-independent — a 30-second captcha
 * solve doesn't break it, and neither does a 2-minute reauth.
 *
 * The detector also keeps a simple "last URL + timestamp" pair for
 * backwards-compat callers (isRedirect / getLastUrl / clearTabUrl),
 * so Phase B can roll out without ripping out the old API surface.
 */
const HISTORY_WINDOW = 6;

export type HistoryEntry = {
  url: Url;
  urlKey: string;
  nodeId: NodeId | null;
  timestamp: number;
};

export class RedirectDetector {
  /** Legacy: just last URL + timestamp. Preserved for isRedirect callers. */
  private lastTabUrl: Map<TabId, UrlWithTimestamp> = new Map();
  /** Rolling URL history per tab (newest last, max HISTORY_WINDOW). */
  private history: Map<TabId, HistoryEntry[]> = new Map();

  static readonly REDIRECT_THRESHOLD_MS: number = 2000;

  recordTabUrl(tabId: TabId, url: UrlWithTimestamp): UrlWithTimestamp | undefined {
    const prev = this.lastTabUrl.get(tabId);
    this.lastTabUrl.set(tabId, url);
    return prev;
  }

  getLastUrl(tabId: TabId): UrlWithTimestamp | undefined {
    return this.lastTabUrl.get(tabId);
  }

  /**
   * Legacy time-window redirect check. Still exported because a few
   * call-sites reference it, but Phase B logic should prefer
   * `findRoundTrip` which is dwell-time-independent.
   */
  isRedirect(tabId: TabId, url: UrlWithTimestamp): boolean {
    const lastUrl = this.lastTabUrl.get(tabId);
    if (!lastUrl || lastUrl.url === url.url) return false;
    return url.timestamp - lastUrl.timestamp < RedirectDetector.REDIRECT_THRESHOLD_MS;
  }

  /**
   * Append a navigation to the tab's history. `nodeId` is the node
   * the navigation resolved to (after tree mutation) — callers pass
   * it so round-trip detection can restore the correct mapping.
   */
  pushHistory(tabId: TabId, url: Url, nodeId: NodeId | null, timestamp: number): void {
    const trail = this.history.get(tabId) ?? [];
    trail.push({ url, urlKey: createUrlKey(url), nodeId, timestamp });
    while (trail.length > HISTORY_WINDOW) trail.shift();
    this.history.set(tabId, trail);
  }

  /**
   * Look up whether `url` matches any previous entry in this tab's
   * history (by URL key). Returns the matched entry — callers use
   * its `nodeId` to restore tab→node mapping — or undefined.
   *
   * When a match is found, the trail is truncated to the matched
   * entry so the next round-trip check starts fresh from there.
   */
  findRoundTrip(tabId: TabId, url: Url): HistoryEntry | undefined {
    const trail = this.history.get(tabId);
    if (!trail || trail.length === 0) return undefined;
    const key = createUrlKey(url);
    // Walk from oldest to newest: if there's a match, it's the
    // round-trip target. Everything after the match is the detour.
    for (let i = 0; i < trail.length; i++) {
      if (trail[i]!.urlKey === key) {
        const matched = trail[i]!;
        // Truncate so subsequent check starts clean after the match.
        this.history.set(tabId, trail.slice(0, i + 1));
        return matched;
      }
    }
    return undefined;
  }

  /** Return a copy of the history trail for diagnostics / tests. */
  getHistory(tabId: TabId): readonly HistoryEntry[] {
    return this.history.get(tabId) ?? [];
  }

  clearTabUrl(tabId: TabId): void {
    this.lastTabUrl.delete(tabId);
    this.history.delete(tabId);
  }
}

export const redirectDetector = new RedirectDetector();
export const REDIRECT_THRESHOLD_MS = RedirectDetector.REDIRECT_THRESHOLD_MS;
