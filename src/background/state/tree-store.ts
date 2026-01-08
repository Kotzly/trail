import type { NodeId } from "../../shared/types/ids";
import { TreeEntry } from "../../shared/types/node";
import { TreeNode } from "./treenode";
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
            if (node.children.length === 0 && node !== tree.getCurrent()) {
                if (node.timestamp < oldestTime) {
                    oldest = node;
                    oldestTime = node.timestamp;
                }
            }
            for (const c of node.children) visit(c);
        }

        const root = tree.getRoot();
        if (root) visit(root);
        return oldest;
    }

    // todo: move this somewhere else when we need to add configurable eviction policies.
    private removeNode(victim: TreeNode): void {
        console.log("removeNode called in LRUEvictionPolicy. no-op for now");
    }
}



export class NavigationTree {
    private root: TreeNode | null = null;
    private current: TreeNode | null = null;
    private nodeCount: number;

    private evictionPolicy: EvictionPolicy;

    constructor(capacity: number = 100) {
        this.evictionPolicy = new LRUEvictionPolicy(this, capacity) // current incomplete solution. 
        // TODO: add configurable eviction policies (for power users)
        this.nodeCount = 0;
    }

    size(): number {
        return this.nodeCount;
    }

    getRoot(): TreeNode | null {
        return this.root;
    }

    getCurrent(): TreeNode | null {
        return this.current;
    }

    setCurrent(node: TreeNode): void {
        this.current = node;
    }

    // todo: add `set root` functionality


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

    findNodeByIdDFS(id: NodeId): TreeNode | null {
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
    
    collectPinned(root: TreeNode | null = this.root): Set<TreeNode> {
        if (!root) return new Set<TreeNode>();

        const pinned: Set<TreeNode> = new Set<TreeNode>();
        const visit = (node: TreeNode) => {
            if (node.pinned) {
                pinned.add(node);
            }
            for (const child of node.children) visit(child);
        }
        visit(root);
        return pinned;
    }

    findNodesByQuery(query: string): NodeId[] {
        const matches: NodeId[] = [];

        const visit = (node: TreeNode) => {
            if (!node) return;
            const q = query.toLowerCase();
            const title = (node.title || '').toLowerCase();
            const url = (node.url || '').toLowerCase();
            let domain = '';
            try {
                domain = new URL(node.url).hostname.toLowerCase();
            } catch (e) {
                console.error(`Error getting domain for url ${node.url}: ${e}`);
                domain = '';
            }
            if (title.includes(query) || url.includes(query) || domain.includes(query)) {
                matches.push(node.id);
            }
            for (const child of node.children) visit(child);
        }

        if (this.root) visit(this.root);
        return matches;
    }
    
}


