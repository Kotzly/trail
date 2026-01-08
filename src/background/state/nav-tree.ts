import type { NodeId, Url } from "../../shared/types/ids";
import { TreeNode } from "./tree-node";
import { DefaultNavigationOptions, type NavigationOptions } from "../../shared/types/tree";
import { EvictionPolicy, LRUEvictionPolicy, Owner } from "../../shared/lib/eviction";
import { NodeData, NavigationNode, updateNodeData } from "../../shared/types/node";


function epForTree(tree: NavigationTree, capacity: number): EvictionPolicy {
    return new LRUEvictionPolicy(tree, capacity); // use LRU eviction policy for now.
}


export class NavigationTree implements Owner {
    private root: NavigationNode | null = null;
    private current: NavigationNode | null = null;
    private nodeCount: number = 0;
    private nodeMap: Map<NodeId, NavigationNode> = new Map<NodeId, NavigationNode>();

    private evictionPolicy: EvictionPolicy;

    constructor(capacity: number, root?: NavigationNode) {
        this.evictionPolicy = epForTree(this, capacity);
        this.nodeCount = 0;
        if (root) {
            this.constructFromRoot(root);
        }
    }

    private constructFromRoot(root: NavigationNode): void {
        this.root = root;
        this.current = root;
        let count = 0;

        this.root.forEach((node) => {
            this.nodeMap.set(node.id, node);
            ++count;
        });

        this.nodeCount = count;
        this.evictionPolicy.enforce();
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
            this.current.data = updateNodeData(this.current.data, data);
            return this.current;
        } 

        // if current has a child with the same url ==> update metadata
        const existingChild = this.current.getChildren().find(c => c.data.url === data.url);
        if (existingChild) {
            existingChild.data = updateNodeData(existingChild.data, data);
            this.current = existingChild;
            return existingChild;
        }

        // if backOnRevisit: search ancestors
        if (options.backOnRevisit ?? DefaultNavigationOptions.backOnRevisit) {
            let ancestor = this.current.getParent();
            while (ancestor) {
                if (ancestor.data.url === data.url) {
                    ancestor.data = updateNodeData(ancestor.data, data);
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
        this.nodeCount++;
        this.evictionPolicy.enforce();
        return child;
    }

    findNodeById(id: NodeId): NavigationNode | null {
        const node = this.nodeMap.get(id);
        return node ?? null
    }
    
    collectPinned(root: NavigationNode | null = this.root): Set<NavigationNode> {
        const pinned: Set<NavigationNode> = new Set<NavigationNode>();
        root?.forEach((node: NavigationNode) => {
            if (node.data.pinned) {
                pinned.add(node);
            }
        });
        return pinned;
    }

    findNodesByQuery(query: string): NodeId[] {
        const matches: NodeId[] = [];
        const q = query.toLowerCase();

        this.root?.forEach((node: NavigationNode) => {
            const title = (node.data.title || '').toLowerCase();
            const url = (node.data.url || '').toLowerCase();
            let domain = '';
            try {
                domain = new URL(node.data.url).hostname.toLowerCase();
            } catch (e) {
                console.error(`Error getting domain for url ${node.data.url}: ${e}`);
                domain = '';
            }
            if (title.includes(q) || url.includes(q) || domain.includes(q)) {
                matches.push(node.id);
            }
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
        return !node.isRoot() && !node.data.pinned && node.data.collapsed;
    }
}


