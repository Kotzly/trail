/**
 * Tree-mutation RPC handlers — rename, reparent, duplicate.
 *
 * Each operation:
 *   1. Looks up nodes, validates the request.
 *   2. Calls `snapshot()` to record the pre-mutation tree for undo.
 *   3. Mutates `NavigationTree` in place.
 *   4. Caches and notifies the UI.
 *
 * Renamed from `editor-handlers.ts` after editor mode was removed —
 * these handlers never depended on the mode flag, only the snapshot
 * scaffolding migrated with them.
 */

import { RPC_METHOD, defineRpcHandlers } from "../../../shared/rpc/contracts.js";
import { treeStorage } from "../../services/tree-storage.js";
import { notifyTreeUpdate } from "../notifications.js";
import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import { CommandManager } from "@shared/lib/commands.js";
import type { Description, NodeId } from "@shared/types/ids.js";
import type { NavigationTree } from "../../state/nav-tree.js";
import type { NavigationNode, NodeData } from "@shared/types/node.js";
import { type TreeNode } from "../../state/tree-node.js";

function snapshot(tree: NavigationTree, description: string): void {
  CommandManager.saveSnapshot(NavigationTreeMapper.toJSON(tree), description as Description);
}

/**
 * Walk up from `candidateId`; if we reach `ancestorId`, the candidate
 * sits inside the ancestor's subtree (so reparenting onto it would
 * create a cycle).
 */
function isDescendant(tree: NavigationTree, ancestorId: NodeId, candidateId: NodeId): boolean {
  let node = tree.findNodeById(candidateId);
  while (node) {
    if (node.id === ancestorId) return true;
    node = node.getParent();
  }
  return false;
}

/** Deep-clone a subtree under `parent`, with fresh node IDs. */
function cloneSubtree(
  source: NavigationNode,
  parent: NavigationNode,
  tree: NavigationTree,
): NavigationNode {
  const clone = parent.addChild({ ...source.data });
  for (const child of source.getChildren()) {
    cloneSubtree(child, clone, tree);
  }
  return clone;
}

export const mutationHandlers = defineRpcHandlers({
  async [RPC_METHOD.REPARENT_NODE](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) throw new Error("Node not found");

    const newParent = tree.findNodeById(message.newParentId);
    if (!newParent) throw new Error("New parent not found");

    if (node.isRoot()) throw new Error("Cannot reparent root node");

    if (isDescendant(tree, message.nodeId, message.newParentId)) {
      throw new Error("Cannot reparent to a descendant");
    }

    if (node.getParent()?.id === message.newParentId) return;

    snapshot(tree, "Reparent node");

    newParent.attachChild(node);

    const resetLayout = (n: TreeNode<NodeData>) => {
      if (n.data.layout) {
        const { layout: _, ...rest } = n.data;
        n.data = rest as NodeData;
      }
      for (const child of n.getChildren()) {
        resetLayout(child);
      }
    };
    resetLayout(node);

    treeStorage.cacheTree(tree);

    await notifyTreeUpdate(tree, "reparent", {
      focusNodeId: message.nodeId,
      mode: "soft",
    });
  },

  async [RPC_METHOD.RENAME_NODE](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) throw new Error("Node not found");

    const nextTitle = message.title.trim();
    if (nextTitle.length === 0) throw new Error("Title cannot be empty");
    if (nextTitle.length > 500) throw new Error("Title is too long");

    const currentTitle = String(node.data.title ?? "");
    if (currentTitle === nextTitle) return;

    snapshot(tree, "Rename node");

    node.data = { ...node.data, title: nextTitle as NodeData["title"] };

    treeStorage.cacheTree(tree);

    await notifyTreeUpdate(tree, "rename", {
      focusNodeId: message.nodeId,
      mode: "soft",
    });
  },

  async [RPC_METHOD.DUPLICATE_SUBTREE](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) throw new Error("Node not found");

    const targetParent = tree.findNodeById(message.targetParentId);
    if (!targetParent) throw new Error("Target parent not found");

    const currentParent = node.getParent();
    if (currentParent?.id === message.targetParentId) {
      throw new Error("Cannot duplicate to the same parent");
    }

    if (
      message.nodeId === message.targetParentId ||
      isDescendant(tree, message.nodeId, message.targetParentId)
    ) {
      throw new Error("Cannot duplicate into own subtree");
    }

    snapshot(tree, "Duplicate subtree");

    cloneSubtree(node, targetParent, tree);

    const json = NavigationTreeMapper.toJSON(tree);
    const refreshed = NavigationTreeMapper.fromTrustedJSON(json);
    treeStorage.cacheTree(refreshed);

    await notifyTreeUpdate(refreshed, "duplicate", {
      focusNodeId: message.targetParentId,
      mode: "soft",
    });
  },
});
