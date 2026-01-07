import type { TabId, Url, UrlWithTimestamp } from '../../shared/types/ids';

// Track last URL per tab for redirect detection
export class RedirectDetector {
  private lastTabUrl: Map<TabId, UrlWithTimestamp> = new Map();
  static readonly REDIRECT_THRESHOLD_MS: number = 2000;

  // Record URL for a tab.
  recordTabUrl(tabId: TabId, url: UrlWithTimestamp): void {
    this.lastTabUrl.set(tabId, url);
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
