import { type NodeId, now, type Timestamp } from "@shared/types/ids.js";
let nodeIdCounter = 0 as NodeId;

function nextNodeId(): NodeId {
  return ++nodeIdCounter as NodeId;
}

type iter = "dfs" | "bfs";
const defaultIter: iter = "dfs";

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
    this.children = [...this.children, child];
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
        prev.removeChildAt(prevIndex);
      }
    }

    child.setParent(this);
    const idx = options?.index;
    if (typeof idx === "number" && idx >= 0 && idx <= this.children.length) {
      this.children = [...this.children.slice(0, idx), child, ...this.children.slice(idx)];
    } else {
      this.children = [...this.children, child];
    }
  }

  // Move all children from this node to the target node (preserves order).
  transferChildrenTo(target: TreeNode<T>): void {
    if (target === this) return;
    const kids = this.children;
    this.children = [];
    for (const child of kids) {
      child.setParent(target);
    }
    target.children = [...target.children, ...kids];
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
      this.parent.removeChildAt(index);
    }
    for (const c of [...this.children]) {
      c.setParent(this.parent);
    }
    this.parent.appendChildren(this.children);
    this.children = [];
    this.parent = null;
  }

  // Detach this node from its parent without reattaching children.
  // Useful for removing entire subtrees.
  detach(): void {
    if (!this.parent) return;
    const index = this.parent.children.indexOf(this);
    if (index !== -1) {
      this.parent.removeChildAt(index);
    }
    this.parent = null;
  }

  private setParent(parent: TreeNode<T> | null): void {
    this.parent = parent;
  }

  getChildren(): readonly TreeNode<T>[] {
    return Object.freeze([...this.children]);
  }

  /** Remove the child at the given index, returning a new internal array. */
  removeChildAt(index: number): void {
    if (index < 0 || index >= this.children.length) return;
    this.children = [...this.children.slice(0, index), ...this.children.slice(index + 1)];
  }

  /** Append children from an array (used by deserialization). */
  appendChildren(nodes: TreeNode<T>[]): void {
    this.children = [...this.children, ...nodes];
  }

  *iter(): IterableIterator<TreeNode<T>> {
    const choice: Record<iter, () => IterableIterator<TreeNode<T>>> = {
      dfs: this.iterDFS,
      bfs: this.iterBFS,
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
