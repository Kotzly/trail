import { type NodeId, now, type Timestamp } from "@shared/types/ids.js";
import { uuidv7 } from "@shared/lib/uuid.js";

function nextNodeId(): NodeId {
  return uuidv7() as NodeId;
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

    // Ancestry check: walk up from `this` to root. If `child` appears
    // anywhere in the chain, attaching would create a cycle (DFS
    // iteration would loop forever, serialization would recurse
    // infinitely). Refuse and throw.
    let ancestor: TreeNode<T> | null = this.parent;
    while (ancestor) {
      if (ancestor === child) {
        throw new Error("Cannot attach ancestor as child — would create a cycle");
      }
      ancestor = ancestor.parent;
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

    const parent = this.parent;
    const index = parent.children.indexOf(this);
    const lifted = [...this.children];
    for (const c of lifted) c.setParent(parent);

    // Splice the lifted children into the parent at `this`'s original
    // position instead of appending to the tail. Preserves user-visible
    // ordering when a mid-tree node is deleted (fixes #11: "delete
    // node N; N's 500 children appear after all siblings in parent's
    // tail, and their original position is lost").
    if (index !== -1) {
      parent.children = [
        ...parent.children.slice(0, index),
        ...lifted,
        ...parent.children.slice(index + 1),
      ];
    } else {
      parent.children = [...parent.children, ...lifted];
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
      this.parent.removeChildAt(index);
    }
    this.parent = null;
  }

  private setParent(parent: TreeNode<T> | null): void {
    this.parent = parent;
  }

  /**
   * Returns the children array typed as readonly. The underlying
   * array is NOT copied or frozen on each call — that was a hot-path
   * allocation (20k allocs per render on a 5k-node tree) and the
   * freeze gave false confidence (internal mutations still worked).
   *
   * TypeScript's `readonly T[]` enforces the no-mutation contract at
   * the type level; callers who need a defensive copy can `[...arr]`
   * themselves at the rare sites where it's actually needed.
   */
  getChildren(): readonly TreeNode<T>[] {
    return this.children;
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
