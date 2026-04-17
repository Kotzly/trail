import type { NavigationNode, NavigationNodeJSON } from "../types/node.js";
import { TreeNode } from "@background/state/tree-node.js";
import { type NavigationTreeJSON } from "../types/tree.js";
import { NavigationTree } from "@background/state/nav-tree.js";
import { normalizeNodeData } from "../schemas/node.js";
import { createLogger } from "./logger.js";

const log = createLogger("tree-mapper");

export class TreeNodeMapper {
  static fromJSON(json: NavigationNodeJSON, parent?: NavigationNode): NavigationNode {
    const data = normalizeNodeData(json);
    const node = new TreeNode(data, parent, json.id);

    node.appendChildren((json.children ?? []).map((child) => TreeNodeMapper.fromJSON(child, node)));
    return node;
  }

  static toJSON(node: NavigationNode): NavigationNodeJSON {
    return {
      id: node.id,
      timestamp: node.timestamp,

      data: node.data,

      children: node.getChildren().map(TreeNodeMapper.toJSON),
    };
  }
}

export class NavigationTreeMapper {
  static toJSON(tree: NavigationTree): NavigationTreeJSON {
    const root = tree.getRoot();
    const current = tree.getCurrent();
    const nodeCount = tree.size();

    return {
      root: root ? TreeNodeMapper.toJSON(root) : null,
      currentNodeId: current?.id ?? null,
      nodeCount: nodeCount,
    };
  }

  static fromJSON(json: NavigationTreeJSON): NavigationTree {
    if (!json.root) {
      return new NavigationTree();
    }

    const root = TreeNodeMapper.fromJSON(json.root);
    const tree = new NavigationTree(root);

    if (json.currentNodeId) {
      const ok = tree.setCurrentById(json.currentNodeId);
      if (!ok) {
        // Persisted current references a node that was removed in a
        // prior session (e.g., merged away by deleteNode cleanup
        // before save). Falls through to root fallback below.
        log.warn("persisted currentNodeId not found — falling back to root", {
          currentNodeId: json.currentNodeId,
        });
      }
    }
    if (!tree.getCurrent() && tree.getRoot()) {
      tree.setCurrent(tree.getRoot()!);
    }

    return tree;
  }
}
