import { RPC_METHOD, defineRpcHandlers, type TreeViewIntent } from "@shared/rpc/contracts.js";
import type { NodeId } from "@shared/types/ids.js";
import { treeStorage } from "../../services/tree-storage.js";
import { notifyTreeUpdate } from "../notifications.js";
import type { NavigationTree } from "../../state/nav-tree.js";
import {
  closeTabsForNodes,
  getDeleteFocusView,
  reassignTabsForRedirects,
  snapshot,
} from "./snapshots.js";

/**
 * Per-handler mutation callback. Receives the live tree and returns
 * the ids of nodes that were removed (used to close associated tabs).
 * Implementations are responsible for any redirect bookkeeping via
 * `reassignTabsForRedirects` before returning.
 *
 * `mutate` may throw to abort the operation; because we snapshot the
 * tree BEFORE calling `mutate`, a thrown exception leaves the undo
 * stack with a no-op entry — same as the legacy handlers, where the
 * post-`tree.deleteNode` "Node not found" branch also fired after the
 * snapshot had been pushed. Callers should validate upfront (before
 * `runDelete`) when they need to fail without polluting undo.
 */
type DeleteMutate = (tree: NavigationTree) => NodeId[] | Promise<NodeId[]>;

/**
 * Shared core for all six delete handlers: validate → snapshot → mutate
 * → persist → notify. The per-handler difference is the mutation
 * callback, plus a description string saved with the undo entry.
 */
async function runDelete(desc: string, mutate: DeleteMutate): Promise<void> {
  const tree = await treeStorage.getOrCreateTree();
  const prevCurrentId = tree.getCurrentId();
  snapshot(tree, desc);
  const removedIds = await mutate(tree);
  await closeTabsForNodes(removedIds);
  treeStorage.cacheTree(tree);
  const view: TreeViewIntent | undefined = getDeleteFocusView(tree, prevCurrentId);
  await notifyTreeUpdate(tree, "delete", view);
}

export const nodeDeleteHandlers = defineRpcHandlers({
  async [RPC_METHOD.DELETE_NODE](message) {
    // Pre-validate so a missing node fails cleanly without pushing a
    // snapshot onto the undo stack.
    const tree = await treeStorage.getOrCreateTree();
    if (!tree.findNodeById(message.nodeId)) throw new Error("Node not found");
    await runDelete("Delete node", (tree) => {
      const result = tree.deleteNode(message.nodeId);
      if (result.removed.length === 0) throw new Error("Node not found");
      reassignTabsForRedirects(result.redirects);
      return result.removed.map((node) => node.id);
    });
  },

  async [RPC_METHOD.DELETE_CHILDREN](message) {
    const tree = await treeStorage.getOrCreateTree();
    if (!tree.findNodeById(message.nodeId)) throw new Error("Node not found");
    await runDelete("Delete children", (tree) => {
      const removed = tree.deleteChildren(message.nodeId);
      if (removed.length === 0) throw new Error("Node not found");
      return removed.map((node) => node.id);
    });
  },

  async [RPC_METHOD.DELETE_WITH_CHILDREN](message) {
    const tree = await treeStorage.getOrCreateTree();
    if (!tree.findNodeById(message.nodeId)) throw new Error("Node not found");
    await runDelete("Delete subtree", (tree) => {
      const removed = tree.deleteSubtree(message.nodeId);
      if (removed.length === 0) throw new Error("Node not found");
      return removed.map((node) => node.id);
    });
  },

  async [RPC_METHOD.BULK_DELETE](message) {
    await runDelete("Delete selection", (tree) => {
      const removedIds: NodeId[] = [];
      for (const id of message.nodeIds) {
        const removed = tree.deleteSubtree(id);
        removedIds.push(...removed.map((node) => node.id));
      }
      return removedIds;
    });
  },

  async [RPC_METHOD.BULK_DELETE_NODES](message) {
    await runDelete("Delete selected nodes", (tree) => {
      const removedIds: NodeId[] = [];
      for (const id of message.nodeIds) {
        const result = tree.deleteNode(id);
        removedIds.push(...result.removed.map((node) => node.id));
        reassignTabsForRedirects(result.redirects);
      }
      return removedIds;
    });
  },

  async [RPC_METHOD.BULK_DELETE_RECURSIVE](message) {
    await runDelete("Delete selected nodes recursively", (tree) => {
      const removedIds: NodeId[] = [];
      const selectedIds = new Set<NodeId>(message.nodeIds);
      const candidates: NodeId[] = [];

      for (const id of message.nodeIds) {
        const node = tree.findNodeById(id);
        if (!node) continue;
        if (node.isRoot()) {
          // Root selected: wipe its entire subtree and stop —
          // anything else in the selection is necessarily a descendant
          // and gets removed along with it.
          const removed = tree.deleteSubtree(id);
          removedIds.push(...removed.map((n) => n.id));
          return removedIds;
        }
        candidates.push(id);
      }

      const topLevelIds: NodeId[] = [];
      for (const id of candidates) {
        const node = tree.findNodeById(id);
        if (!node) continue;
        let parent = node.getParent();
        let skip = false;
        while (parent) {
          if (selectedIds.has(parent.id)) {
            skip = true;
            break;
          }
          parent = parent.getParent();
        }
        if (!skip) topLevelIds.push(id);
      }

      for (const id of topLevelIds) {
        const removed = tree.deleteSubtree(id);
        removedIds.push(...removed.map((node) => node.id));
      }

      return removedIds;
    });
  },
});
