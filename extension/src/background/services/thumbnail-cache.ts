import { browser } from "@shared/platform/webext.js";

// ---------------------------------------------------------------------------
// LRU Screenshot Cache — captures visible tabs on activation, serves to QuickLook
// ---------------------------------------------------------------------------

const MAX_CACHE_SIZE = 32;
const CAPTURE_DELAY_MS = 1500;

class ThumbnailCache {
  private cache = new Map<number, string>(); // tabId → JPEG data-URL
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  /** Call once during service-worker bootstrap to wire up listeners. */
  init(): void {
    browser.tabs.onActivated.addListener((info) => {
      this.scheduleCapture(info.tabId);
    });
    browser.tabs.onRemoved.addListener((tabId) => {
      this.cache.delete(tabId);
    });
  }

  // ── public API ────────────────────────────────────────────────────────────

  /** Return the first cached thumbnail matching any of the given tabIds. */
  getByTabIds(tabIds: ReadonlySet<number> | number[]): string | null {
    for (const id of tabIds) {
      const hit = this.cache.get(id);
      if (hit) return hit;
    }
    return null;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private scheduleCapture(tabId: number): void {
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      void this.captureTab(tabId);
    }, CAPTURE_DELAY_MS);
  }

  private async captureTab(tabId: number): Promise<void> {
    try {
      const tab = await browser.tabs.get(tabId);
      if (!tab?.active || tab.windowId == null) return;

      const url = tab.url ?? "";
      if (
        url.startsWith("chrome://") ||
        url.startsWith("chrome-extension://") ||
        url.startsWith("about:") ||
        url.startsWith("moz-extension://")
      ) {
        return;
      }

      const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
        format: "jpeg",
        quality: 25,
      });
      this.set(tabId, dataUrl);
    } catch {
      // Some pages block capture (e.g. browser-internal pages) — silently skip.
    }
  }

  private set(tabId: number, dataUrl: string): void {
    // Evict oldest entry when at capacity
    if (this.cache.size >= MAX_CACHE_SIZE && !this.cache.has(tabId)) {
      const oldest = this.cache.keys().next().value!;
      this.cache.delete(oldest);
    }
    // Delete-then-set moves the key to the end (LRU order in Map)
    this.cache.delete(tabId);
    this.cache.set(tabId, dataUrl);
  }
}

export const thumbnailCache = new ThumbnailCache();
thumbnailCache.init();
