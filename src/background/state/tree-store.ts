import type { NodeId } from "../../shared/types/ids";
import { TreeNode, TreeEntry } from "../../shared/types/node";
import type { NavigationOptions } from "../../shared/types/tree";

interface EvictionPolicy {
    enforce(tree: NavigationTree): void;
}

class LRUEvictionPolicy implements EvictionPolicy {
    private capacity: number;
    private readonly tree: NavigationTree;
    constructor(tree: NavigationTree, cap: number) {
        this.tree = tree;
        this.capacity = cap;
    }

    updateCapacity(cap: number): void {
        this.capacity = cap;
    }

    enforce(tree: NavigationTree): void {
        while (tree.size() > this.capacity) {
            const victim = this.findVictim(tree);
            if (!victim) return;
            this.removeNode(victim);
        }
    }

    private findVictim(tree: NavigationTree): TreeNode | null {
        let oldest: TreeNode | null = null;
        let oldestTime = Infinity;

        const visit = (node: TreeNode) => {
            if (node.children.length === 0 && node !== tree.current) {
                if (node.timestamp < oldestTime) {
                    oldest = node;
                    oldestTime = node.timestamp;
                }
            }
            for (const c of node.children) visit(c);
        }

        if (tree.root) visit(tree.root);
        return oldest;
    }

    // todo: move this somewhere else when we need to add configurable eviction policies.
    private removeNode(victim: TreeNode): void {
        console.log("removeNode called in LRUEvictionPolicy. no-op for now");
    }
}



export class NavigationTree {
    root: TreeNode | null = null;
    current: TreeNode | null = null;
    nodeCount: number;

    private evictionPolicy: EvictionPolicy;

    constructor(capacity: number = 100) {
        this.evictionPolicy = new LRUEvictionPolicy(this, capacity) // current incomplete solution. 
        // TODO: add configurable eviction policies (for power users)
        this.nodeCount = 0;
    }

    size(): number {
        return this.nodeCount;
    }

    init(entry: TreeEntry): TreeNode {
        if (this.root) return this.root;
        const root = new TreeNode(entry);
        this.root = root;
        this.current = root;
        this.nodeCount = 1;
        return root;
    }

    navigate(entry: TreeEntry, options: NavigationOptions = {}): TreeNode {
        const {
            backOnRevisit = true
        } = options;

        // no root ==> create it
        if (!this.root) {
            return this.init(entry);
        }
        
        // QUESTION: how should we handle this.current === null?
        if (!this.current) {
            return this.init(entry);
        }

        // same url as current ==> update metadata
        if (this.current.url === entry.url) {
            this.current.updateMetadata(entry);
            return this.current;
        }

        // if current has a child with the same url ==> update metadata
        const existingChild = this.current.children.find(c => c.url === entry.url);
        if (existingChild) {
            existingChild.updateMetadata(entry);
            return existingChild;
        }

        // if backOnRevisit: search ancestors
        if (backOnRevisit) {
            let ancestor = this.current.parent;
            while (ancestor) {
                if (ancestor.url === entry.url) {
                    ancestor.updateMetadata(entry);
                    return ancestor;
                }
                ancestor = ancestor.parent;
            }
        }

        // create a child
        return this.createChild(this.current, entry);
    }

    createChild(node: TreeNode, entry: TreeEntry): TreeNode {
        const child = node.addChild(entry);
        this.nodeCount++;
        this.evictionPolicy.enforce(this);
        return child;
    }

    findById(id: NodeId): TreeNode | null {
        const find = (node: TreeNode | null): TreeNode | null => {
            if (!node) return null;
            if (node.id === id) return node;
            for (const child of node.children) {
                const found = find(child);
                if (found) return found;
            }
            return null;
        }
        return find(this.root);
      }
}


