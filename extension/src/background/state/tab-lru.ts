import type { NodeId, TabId } from "@shared/types/ids.js";

export class LruManager {
  private set: Set<TabId>;
  private lastUsed = new Map<TabId, number>();
  private latestTabId: TabId | null = null;
  private latestNodeId: NodeId | null = null;
  constructor() {
    this.set = new Set<TabId>();
  }

  touch(tabId: TabId, nodeId: NodeId, lastUsed?: number) {
    this.set.delete(tabId);
    this.set.add(tabId);

    const nextUsed = lastUsed ?? Date.now();
    this.lastUsed.set(tabId, nextUsed);
    this.latestTabId = tabId;
    this.latestNodeId = nodeId;
  }

  track(tabId: TabId, nodeId: NodeId, lastUsed?: number) {
    if (!this.set.has(tabId)) {
      this.set.add(tabId);
    }
    if (lastUsed !== undefined) {
      this.lastUsed.set(tabId, lastUsed);
      const latest = this.latestTabId ? (this.lastUsed.get(this.latestTabId) ?? 0) : -1;
      if (lastUsed >= latest) {
        this.latestTabId = tabId;
        this.latestNodeId = nodeId;
      }
    } else if (!this.lastUsed.has(tabId)) {
      this.lastUsed.set(tabId, 0);
    }
  }

  iter(): IterableIterator<TabId> {
    return this.set.keys();
  }

  getLastUsed(tabId: TabId): number {
    return this.lastUsed.get(tabId) || 0;
  }

  remove(tabId: TabId) {
    this.lastUsed.delete(tabId);
    if (this.latestTabId === tabId) {
      // Find the next-most-recently used tab from the remaining set.
      let nextId: TabId | null = null;
      let nextTs = -1;
      for (const [id, ts] of this.lastUsed) {
        if (id !== tabId && ts > nextTs) {
          nextTs = ts;
          nextId = id;
        }
      }
      this.latestTabId = nextId;
      if (nextId === null) this.latestNodeId = null;
      // Note: latestNodeId for nextId is unknown at this layer — callers that
      // depend on it after a remove should look it up via tabManager.nodeByTab.
    }
    return this.set.delete(tabId);
  }

  getLatestTabId(): TabId | null {
    return this.latestTabId;
  }

  getLatestNodeId(): NodeId | null {
    return this.latestNodeId;
  }
}
