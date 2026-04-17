import { handleNavigation } from "./navigation-handler.js";
import { redirectDetector } from "./redirect-detection.js";
import { browser, type Browser } from "@shared/platform/webext.js";
import type { TabId } from "@shared/types/ids.js";

/**
 * Dedup window for a single documentId across the three webNav listeners
 * (onCommitted + onHistoryStateUpdated + onReferenceFragmentUpdated).
 * Chrome can fire all three for one SPA-style navigation; we want one
 * tree mutation per observed document transition, not three.
 */
const DEDUP_TTL_MS = 300;
const documentSeenAt = new Map<string, number>();

function isFreshDocument(
  details: Browser.webNavigation.WebNavigationFramedCallbackDetails,
): boolean {
  const d = details as Browser.webNavigation.WebNavigationFramedCallbackDetails & {
    documentId?: string;
  };
  if (!d.documentId) return true; // No documentId → always allow
  const now = Date.now();
  // Opportunistically GC old entries.
  if (documentSeenAt.size > 64) {
    for (const [key, ts] of documentSeenAt.entries()) {
      if (now - ts > DEDUP_TTL_MS * 4) documentSeenAt.delete(key);
    }
  }
  const key = `${d.tabId}:${d.documentId}:${d.url}`;
  const prev = documentSeenAt.get(key);
  if (prev !== undefined && now - prev < DEDUP_TTL_MS) return false;
  documentSeenAt.set(key, now);
  return true;
}

/**
 * Initialize webNavigation event listeners.
 */
export function initWebNavigation(): void {
  const listener = (
    details: Browser.webNavigation.WebNavigationFramedCallbackDetails & {
      transitionType?: string;
      transitionQualifiers?: readonly string[];
      documentId?: string;
    },
  ): void => {
    // Dedup fan-out from the three webNav listeners for the same
    // document transition (SPAs fire all three; we want one mutation).
    if (!isFreshDocument(details)) return;
    handleNavigation(details, details.transitionType).catch(() => {
      // Navigation handler error — silently ignored.
    });
  };

  browser.webNavigation.onCommitted.addListener(listener);
  browser.webNavigation.onHistoryStateUpdated.addListener(listener);
  browser.webNavigation.onReferenceFragmentUpdated.addListener(listener);

  // Invalidate a tab's redirect-detection state on nav errors so
  // aborted navigations don't poison the next real nav's "is this
  // a redirect?" decision.
  browser.webNavigation.onErrorOccurred.addListener((details) => {
    if (details.frameId !== 0) return;
    redirectDetector.clearTabUrl(details.tabId as TabId);
  });
}
