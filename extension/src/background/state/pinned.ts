import { type NavigationNode } from "@shared/types/node.js";
import { type NavigationTree } from "./nav-tree.js";

export class PinnedManager {
  private tree: NavigationTree;
  pinned: Set<NavigationNode>; // todo: perhaps, nodeId would be better here?

  constructor(tree: NavigationTree) {
    this.tree = tree;
    this.pinned = this.tree.collectPinned();
  }

  pin(node: NavigationNode) {
    this.pinned.add(node);
  }

  isPinned(node: NavigationNode): boolean {
    return this.pinned.has(node);
  }

  unpin(node: NavigationNode) {
    this.pinned.delete(node);
  }
}
