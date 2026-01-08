import type { TabId, Url, UrlWithTimestamp } from '../../shared/types/ids.js';

// Track last URL per tab for redirect detection
export class RedirectDetector {
  private lastTabUrl: Map<TabId, UrlWithTimestamp> = new Map();
  static readonly REDIRECT_THRESHOLD_MS: number = 2000;

  // Record URL for a tab and return previous URL.
  recordTabUrl(tabId: TabId, url: UrlWithTimestamp): UrlWithTimestamp | undefined {
    const prev = this.lastTabUrl.get(tabId);
    this.lastTabUrl.set(tabId, url);
    return prev;
  }

  // Get last recorded URL for a tab.
  getLastUrl(tabId: TabId): UrlWithTimestamp | undefined {
    return this.lastTabUrl.get(tabId);
  }

  // Check if navigation is a redirect (same tab, different URL, within threshold).
  isRedirect(tabId: TabId, url: UrlWithTimestamp): boolean {
    const lastUrl = this.lastTabUrl.get(tabId);
    if (!lastUrl || lastUrl.url === url.url) return false;

    return (url.timestamp - lastUrl.timestamp < RedirectDetector.REDIRECT_THRESHOLD_MS)
  }

  // Clear URL tracking for a tab.
  clearTabUrl(tabId: TabId): void {
    this.lastTabUrl.delete(tabId);
  }
}

export const redirectDetector = new RedirectDetector();
export const REDIRECT_THRESHOLD_MS = RedirectDetector.REDIRECT_THRESHOLD_MS;
