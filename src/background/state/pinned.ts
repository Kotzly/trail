import { NavigationTree } from "./nav-tree"
import { TreeNode } from "./tree-node";

export class PinnedManager {
    private tree: NavigationTree
    pinned: Set<TreeNode> // todo: perhaps, nodeId would be better here?

    constructor(tree: NavigationTree) {
        this.tree = tree;
        this.pinned = this.tree.collectPinned();
    }

    pin(node: TreeNode) {
        this.pinned.add(node);
    }

    isPinned(node: TreeNode): boolean {
        return this.pinned.has(node);
    }

    unpin(node: TreeNode) {
        this.pinned.delete(node);
    }

}