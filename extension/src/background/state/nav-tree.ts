import type { NodeId, Url } from "../../shared/types/ids.js";
import { TreeNode } from "./tree-node.js";
import { DefaultNavigationOptions, type NavigationOptions } from "../../shared/types/tree.js";
import { EvictionPolicy, LRUEvictionPolicy, Owner } from "../../shared/lib/eviction.js";
import { NodeData, NavigationNode, updateNodeMeta } from "../../shared/types/node.js";


function epForTree(tree: NavigationTree, capacity: number): EvictionPolicy {
    return new LRUEvictionPolicy(tree, capacity); // use LRU eviction policy for now.
}


export class NavigationTree implements Owner {
    private root: NavigationNode | null = null;
    private current: NavigationNode | null = null;
    private nodeCount: number = 0;
    private nodeMap: Map<NodeId, NavigationNode> = new Map<NodeId, NavigationNode>();
    private searchIndex: Map<NodeId, { combined: string }> = new Map<NodeId, { combined: string }>();

    private evictionPolicy: EvictionPolicy;
    private lastEvictedCount = 0;

    constructor(capacity: number, root?: NavigationNode) {
        this.evictionPolicy = epForTree(this, capacity);
        this.nodeCount = 0;
        if (root) {
            this.constructFromRoot(root);
        }
    }

    private constructFromRoot(root: NavigationNode): void {
        this.root = root;
        let count = 0;

        this.root.forEach((node) => {
            this.nodeMap.set(node.id, node);
            this.updateSearchEntry(node);
            ++count;
        });

        this.nodeCount = count;
        const evicted = this.evictionPolicy.enforce();
        this.lastEvictedCount += evicted;
    }

    // remove is called by the eviction policy to remove nodes that are no longer needed.
    remove(node: NavigationNode): void {
        if (!this.canRemove(node)) {
            throw new Error("Node cannot be removed");
        }
        this.removeNode(node);
    }

    private removeNode(node: NavigationNode): void {
        this.nodeCount--;
        this.nodeMap.delete(node.id);
        this.searchIndex.delete(node.id);
        node.remove();
    }

    size(): number {
        return this.nodeCount;
    }

    getRoot(): NavigationNode | null {
        return this.root;
    }

    getCurrent(): NavigationNode | null {
        return this.current;
    }

    setCurrent(node: NavigationNode): void {
        this.current = node;
    }

    getCapacity(): number {
        return this.evictionPolicy.getCapacity();
    }

    setCapacity(capacity: number): number {
        const next = Number.isFinite(capacity) && capacity > 0 ? capacity : Infinity;
        this.evictionPolicy.updateCapacity(next);
        const evicted = this.evictionPolicy.enforce();
        this.lastEvictedCount += evicted;
        return evicted;
    }

    consumeEvictedCount(): number {
        const count = this.lastEvictedCount;
        this.lastEvictedCount = 0;
        return count;
    }

    *iter(): IterableIterator<NavigationNode> {
        if (this.root) {
            yield* this.root.iter();
        }
    }
    
    // todo: implement setRoot logic

    navigate(data: NodeData, options: NavigationOptions = DefaultNavigationOptions): NavigationNode {
        // no root ==> create it
        if (!this.root) {
            this.root = this.createChild(null, data);
            this.current = this.root;
            return this.root;
        }
        
        // QUESTION: how should we handle this.current === null?
        if (!this.current) {
            throw new Error("Current node is null but root is not null");
            // const child = this.createChild(this.root, data);
            // this.current = child;
            // return child;
        }

        // same url as current ==> update metadata
        if (this.current.data.url === data.url) {
            this.current.data = updateNodeMeta(this.current.data, data);
            this.updateSearchEntry(this.current);
            return this.current;
        } 

        // if current has a child with the same url ==> update metadata
        const existingChild = this.current.getChildren().find(c => c.data.url === data.url);
        if (existingChild) {
            existingChild.data = updateNodeMeta(existingChild.data, data);
            this.updateSearchEntry(existingChild);
            this.current = existingChild;
            return existingChild;
        }

        // if backOnRevisit: search ancestors
        if (options.backOnRevisit ?? DefaultNavigationOptions.backOnRevisit) {
            let ancestor = this.current.getParent();
            while (ancestor) {
                if (ancestor.data.url === data.url) {
                    ancestor.data = updateNodeMeta(ancestor.data, data);
                    this.updateSearchEntry(ancestor);
                    this.current = ancestor;
                    return ancestor;
                }
                ancestor = ancestor.getParent();
            }
        }

        // create a child
        const newChild = this.createChild(this.current, data);
        this.current = newChild;
        return newChild;
    }

    createChild(node: NavigationNode | null, data: NodeData): NavigationNode {
        const child = node ? node.addChild(data) : new TreeNode(data);
        this.nodeMap.set(child.id, child);
        this.updateSearchEntry(child);
        this.nodeCount++;
        const evicted = this.evictionPolicy.enforce();
        this.lastEvictedCount += evicted;
        return child;
    }

    findNodeById(id: NodeId): NavigationNode | null {
        const node = this.nodeMap.get(id);
        return node ?? null
    }

    private collectSubtreeNodes(node: NavigationNode): NavigationNode[] {
        const nodes: NavigationNode[] = [];
        for (const n of node.iter()) {
            nodes.push(n);
        }
        return nodes;
    }

    // todo: remove this functionality of deleting nodes
    deleteNode(nodeId: NodeId): NavigationNode[] {
        const node = this.findNodeById(nodeId);
        if (!node || node.isRoot()) return [];

        const parent = node.getParent();
        const removed = [node];

        node.remove();
        this.nodeMap.delete(node.id);
        this.searchIndex.delete(node.id);
        this.nodeCount = Math.max(0, this.nodeCount - 1);

        if (this.current && this.current.id === nodeId) {
            if (parent) this.current = parent;
            else this.current = this.root;
        }

        return removed;
    }

    deleteChildren(nodeId: NodeId): NavigationNode[] {
        const node = this.findNodeById(nodeId);
        if (!node) return [];

        const children = [...node.getChildren()];
        const removed: NavigationNode[] = [];

        for (const child of children) {
            removed.push(...this.collectSubtreeNodes(child));
            child.detach();
        }

        for (const removedNode of removed) {
            this.nodeMap.delete(removedNode.id);
            this.searchIndex.delete(removedNode.id);
        }
        this.nodeCount = Math.max(0, this.nodeCount - removed.length);

        if (this.current && removed.some(n => n.id === this.current?.id)) {
            this.current = node;
        }

        return removed;
    }

    deleteSubtree(nodeId: NodeId): NavigationNode[] {
        const node = this.findNodeById(nodeId);
        if (!node) return [];

        const removed = this.collectSubtreeNodes(node);

        if (node.isRoot()) {
            this.root = null;
            this.current = null;
            this.nodeMap.clear();
            this.searchIndex.clear();
            this.nodeCount = 0;
            return removed;
        }

        const parent = node.getParent();
        node.detach();

        for (const removedNode of removed) {
            this.nodeMap.delete(removedNode.id);
            this.searchIndex.delete(removedNode.id);
        }
        this.nodeCount = Math.max(0, this.nodeCount - removed.length);

        if (this.current && removed.some(n => n.id === this.current?.id)) {
            this.current = parent ?? null;
        }

        return removed;
    }

    clear(): void {
        this.root = null;
        this.current = null;
        this.nodeMap.clear();
        this.searchIndex.clear();
        this.nodeCount = 0;
        this.lastEvictedCount = 0;
    }
    
    collectPinned(root: NavigationNode | null = this.root): Set<NavigationNode> {
        const pinned: Set<NavigationNode> = new Set<NavigationNode>();
        root?.forEach((node: NavigationNode) => {
            if (node.data?.pinned) {
                pinned.add(node);
            }
        });
        return pinned;
    }

    findNodesByQuery(query: string): NodeId[] {
        const matches: NodeId[] = [];
        const q = query.trim().toLowerCase();
        if (!q) return matches;
        const terms = q.split(/\s+/).filter(Boolean);
        if (terms.length === 0) return matches;

        this.root?.forEach((node: NavigationNode) => {
            const entry = this.searchIndex.get(node.id);
            if (!entry) return;
            const matchesAll = terms.every((term) => entry.combined.includes(term));
            if (matchesAll) matches.push(node.id);
        });

        return matches;
    }

    findByUrl(url: Url): NavigationNode | null {
        for (const node of this.iter() ?? []) {
            if (node.data.url === url) {
                return node;
            }
        }
        return null;
    }

    setCurrentById(nodeId: NodeId): void {
        const node = this.findNodeById(nodeId);
        if (!node) return;
        this.setCurrent(node);
    }

    getCurrentId(): NodeId | null {
        return this.current?.id ?? null;
    }

    canRemove(node: NavigationNode): boolean {
        return !node.isRoot() && !node.data.pinned;
    }

    clearCurrent(): void {
        this.current = null;
    }

    private updateSearchEntry(node: NavigationNode): void {
        const title = (node.data.title || '').toLowerCase();
        const url = (node.data.url || '').toLowerCase();
        const domain = NavigationTree.extractDomain(url);
        const combined = `${title} ${url} ${domain}`.trim();
        this.searchIndex.set(node.id, { combined });
    }

    private static extractDomain(url: string): string {
        if (!url) return '';
        try {
            return new URL(url).hostname.toLowerCase();
        } catch {
            const match = url.match(/^(?:https?:\/\/)?([^\/?#]+)/i);
            return match ? match[1]!.toLowerCase() : '';
        }
    }
}
