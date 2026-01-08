import { NavigationNode } from "../../shared/types/node";
import { NavigationTree } from "./nav-tree"

export class PinnedManager {
    private tree: NavigationTree
    pinned: Set<NavigationNode> // todo: perhaps, nodeId would be better here?

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