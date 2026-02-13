import { NodeId, now, Timestamp } from "../../shared/types/ids.js";
let nodeIdCounter = 0 as NodeId;

function nextNodeId(): NodeId {
    return (++nodeIdCounter) as NodeId;
}

type iter = 'dfs' | 'bfs';
const defaultIter: iter = 'dfs';


export class TreeNode<T> implements Timestamped {
    readonly id: NodeId;
    readonly timestamp: Timestamp;
    data: T;
    private parent: TreeNode<T> | null;
    private children: TreeNode<T>[];

    constructor(data: T, parent?: TreeNode<T>, id: NodeId = nextNodeId()) {
        this.id = id;
        if (this.id > nodeIdCounter) {
            nodeIdCounter = this.id;
        }
        this.timestamp = now();
        this.data = data;
        this.parent = parent ?? null;
        this.children = [];
    }

    isRoot(): boolean {
        return this.parent === null;
    }

    // addChild adds a child to this
    addChild(data: T): TreeNode<T> {
        const child = new TreeNode(data, this);
        this.children.push(child);
        return child;
    }

    // Attach an existing node as a child of this node.
    // Detaches the node from its previous parent if needed.
    attachChild(child: TreeNode<T>, options?: { index?: number }): void {
        if (child === this) {
            throw new Error("Cannot attach node to itself");
        }

        // Detach from previous parent, if any.
        if (child.parent) {
            const prev = child.parent;
            const prevIndex = prev.children.indexOf(child);
            if (prevIndex !== -1) {
                prev.children.splice(prevIndex, 1);
            }
        }

        child.setParent(this);
        const idx = options?.index;
        if (typeof idx === "number" && idx >= 0 && idx <= this.children.length) {
            this.children.splice(idx, 0, child);
        } else {
            this.children.push(child);
        }
    }

    // Move all children from this node to the target node (preserves order).
    transferChildrenTo(target: TreeNode<T>): void {
        if (target === this) return;
        const kids = this.children;
        this.children = [];
        for (const child of kids) {
            child.setParent(target);
            target.children.push(child);
        }
    }

    getParent(): TreeNode<T> | null {
        return this.parent;
    }

    remove(): void {
        if (!this.parent) {
            throw new Error("Node has no parent");
        }
        
        const index = this.parent.children.indexOf(this);
        if (index !== -1) {
            this.parent.getChildren().splice(index, 1);
        }
        for (const c of this.children) {
            c.setParent(this.parent);
            this.parent.children.push(c);
        }
        this.children = [];
        this.parent = null;
    }

    // Detach this node from its parent without reattaching children.
    // Useful for removing entire subtrees.
    detach(): void {
        if (!this.parent) return;
        const index = this.parent.children.indexOf(this);
        if (index !== -1) {
            this.parent.children.splice(index, 1);
        }
        this.parent = null;
    }

    private setParent(parent: TreeNode<T> | null): void {
        this.parent = parent;
    }

    getChildren(): TreeNode<T>[] {
        return this.children;
    }

    *iter(): IterableIterator<TreeNode<T>> {
        const choice: Record<iter, () => IterableIterator<TreeNode<T>>> = {
            'dfs': this.iterDFS,
            'bfs': this.iterBFS,
        };
        yield* choice[defaultIter].call(this);
    }

    private *iterDFS(): IterableIterator<TreeNode<T>> {
        function* dfs(node: TreeNode<T>): IterableIterator<TreeNode<T>> {
            yield node;
            for (const child of node.getChildren()) {
                yield* dfs(child);
            }
        }
        yield* dfs(this);
    }

    private *iterBFS(): IterableIterator<TreeNode<T>> {
        const queue: TreeNode<T>[] = [this];
        while (queue.length > 0) {
            const node = queue.shift()!;
            yield node;
            for (const child of node.getChildren()) {
                queue.push(child);
            }
        }
    }

    forEach(callback: (node: TreeNode<T>) => void): void {
        for (const node of this.iter() ?? []) {
            callback(node);
        }
    }

}
type Timestamped = {
    timestamp: Timestamp;
};
