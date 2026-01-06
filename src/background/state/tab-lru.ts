import type { TabId } from "../../shared/types/ids";

export class LruManager {
    private set: Set<TabId>;
    private seq = 0;
    private lastUsed = new Map<TabId, number>();
    public latest: TabId | null = null;
    constructor() {
        this.set = new Set<TabId>();
    }
    
    touch(tabId: TabId) {
        this.set.delete(tabId);
        this.set.add(tabId);

        this.lastUsed.set(tabId, ++this.seq);
        this.latest = tabId;
    }

    iter(): IterableIterator<TabId> {
        return this.set.keys();
    }

    getLastUsed(tabId: TabId): number {
        return this.lastUsed.get(tabId) || 0;
    }


    remove(tabId: TabId) {
        this.lastUsed.delete(tabId);
        if (this.latest === tabId) this.latest = null;
        return this.set.delete(tabId);
    }

}

