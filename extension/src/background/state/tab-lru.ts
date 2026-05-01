import type { NodeId, TabId } from "@shared/types/ids.js";

/**
 * LRU tracker for tabs. latestNodeId is DERIVED from latestTabId via
 * an optional resolver (injected by TabManager); never stored as a
 * separate field. This removes the stale-latestNodeId invariant
 * violation that used to plague remove() (#50).
 */
export class LruManager {
  private set: Set<TabId>;
  private lastUsed = new Map<TabId, number>();
  private latestTabId: TabId | null = null;
  private nodeResolver: ((tabId: TabId) => NodeId | undefined) | null = null;
  constructor() {
    this.set = new Set<TabId>();
  }

  /** Inject a callback so getLatestNodeId can resolve on demand. */
  setNodeResolver(resolver: (tabId: TabId) => NodeId | undefined): void {
    this.nodeResolver = resolver;
  }

  touch(tabId: TabId, _nodeId: NodeId, lastUsed?: number) {
    this.set.delete(tabId);
    this.set.add(tabId);

    const nextUsed = lastUsed ?? Date.now();
    const prev = this.lastUsed.get(tabId);
    // Preserve existing timestamp if the caller didn't provide one
    // AND our new Date.now() would be older (shouldn't happen on a
    // monotonic clock, but guards against test fixtures / clock skew).
    if (lastUsed === undefined && prev !== undefined && prev > nextUsed) {
      // keep prev
    } else {
      this.lastUsed.set(tabId, nextUsed);
    }
    this.latestTabId = tabId;
  }

  track(tabId: TabId, _nodeId: NodeId, lastUsed?: number) {
    if (!this.set.has(tabId)) {
      this.set.add(tabId);
    }
    if (lastUsed !== undefined) {
      this.lastUsed.set(tabId, lastUsed);
      const latest = this.latestTabId ? (this.lastUsed.get(this.latestTabId) ?? -1) : -1;
      if (lastUsed >= latest) {
        this.latestTabId = tabId;
      }
    }
    // If lastUsed is undefined we intentionally do NOT seed a 0 — it
    // would collide with real epoch timestamps in closeOldest sort.
  }

  iter(): IterableIterator<TabId> {
    return this.set.keys();
  }

  /**
   * Returns the last-used timestamp, or undefined for tabs we haven't
   * tracked with a real timestamp. Callers sorting by recency should
   * treat undefined as "put at the start of the candidate list" (not
   * as 0, which used to conflate "never tracked" with "tracked at
   * epoch" — #40).
   */
  getLastUsed(tabId: TabId): number | undefined {
    return this.lastUsed.get(tabId);
  }

  remove(tabId: TabId) {
    this.lastUsed.delete(tabId);
    if (this.latestTabId === tabId) {
      // Find the next-most-recently used tab from the remaining set.
      let nextId: TabId | null = null;
      let nextTs = -Infinity;
      for (const [id, ts] of this.lastUsed) {
        if (id !== tabId && ts > nextTs) {
          nextTs = ts;
          nextId = id;
        }
      }
      this.latestTabId = nextId;
    }
    return this.set.delete(tabId);
  }

  getLatestTabId(): TabId | null {
    return this.latestTabId;
  }

  /**
   * Derived from latestTabId via the injected resolver. If no
   * resolver is set or the latest tab has no registration, returns
   * null — never returns a stale cached value.
   */
  getLatestNodeId(): NodeId | null {
    if (!this.latestTabId) return null;
    return this.nodeResolver?.(this.latestTabId) ?? null;
  }
}
