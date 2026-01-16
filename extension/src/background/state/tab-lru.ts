import type { NodeId, TabId } from "../../shared/types/ids.js";

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
            const latest = this.latestTabId ? this.lastUsed.get(this.latestTabId) ?? 0 : -1;
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
        if (this.latestTabId === tabId) this.latestTabId = null; // todo: check if this is correct
        return this.set.delete(tabId);
    }

    getLatestTabId(): TabId | null {
        return this.latestTabId;
    }

    getLatestNodeId(): NodeId | null {
        return this.latestNodeId;
    }

}
