import type { NodeId, TabId } from "../../shared/types/ids";

export class LruManager {
    private set: Set<TabId>;
    private seq = 0;
    private lastUsed = new Map<TabId, number>();
    private latestTabId: TabId | null = null;
    private latestNodeId: NodeId | null = null;
    constructor() {
        this.set = new Set<TabId>();
    }
    
    touch(tabId: TabId, nodeId: NodeId) {
        this.set.delete(tabId);
        this.set.add(tabId);

        this.lastUsed.set(tabId, ++this.seq);
        this.latestTabId = tabId;
        this.latestNodeId = nodeId;
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

