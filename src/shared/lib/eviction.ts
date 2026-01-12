import { Timestamp } from "../types/ids.js";

export interface Owner {
    size(): number,
    iter(): IterableIterator<Element> | undefined,
    remove(element: Element): void,
    canRemove(element: Element): boolean,
}

export interface Element {
    timestamp: Timestamp;
}

export interface EvictionPolicy {
    getCapacity(): number;
    enforce(): void;
}

export class LRUEvictionPolicy implements EvictionPolicy {
    private capacity: number;
    private owner: Owner;

    constructor(owner: Owner, cap: number) {
        this.capacity = cap;
        this.owner = owner;
    }

    getCapacity(): number {
        return this.capacity;
    }

    updateCapacity(cap: number): void {
        this.capacity = cap;
    }

    enforce(): void {
        const toRemove = this.owner.size() - this.capacity;
        if (toRemove <= 0) return;
        const victims = this.findVictims().slice(0, toRemove);
        for (const victim of victims) {
            this.removeElement(victim);
        }
    }

    private findVictims(): Element[] {
        let victims: Element[] = [];

        const visit = (element: Element) => {
            if (this.owner.canRemove(element)) {
                victims.push(element);
            }
        };

        const iter = this.owner.iter();
        if (iter) {
            for (const element of iter) visit(element);
        }
        return victims.sort((a, b) => a.timestamp - b.timestamp);
    }

    // todo: move this somewhere else when we need to add configurable eviction policies.
    private removeElement(victim: Element): void {
        if (!this.owner.canRemove(victim)) return; // dont remove if it cannot be removed.
        this.owner.remove(victim);
    }
}
