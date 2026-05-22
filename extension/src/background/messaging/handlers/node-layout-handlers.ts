import { RPC_METHOD, defineRpcHandlers } from "@shared/rpc/contracts.js";
import { treeStorage } from "../../services/tree-storage.js";
import { notifyTreeUpdate } from "../notifications.js";
import { updateNodeData } from "@shared/types/node.js";

export const nodeLayoutHandlers = defineRpcHandlers({
  async [RPC_METHOD.SET_NODE_LAYOUT](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) throw new Error("Node not found");
    const existingLayout = node.data.layout ?? { offsetX: 0, offsetY: 0 };
    const nextLayout = {
      offsetX: typeof message.offsetX === "number" ? message.offsetX : existingLayout.offsetX,
      offsetY: typeof message.offsetY === "number" ? message.offsetY : existingLayout.offsetY,
    };
    const hasChanges = typeof message.offsetX === "number" || typeof message.offsetY === "number";
    if (!hasChanges) return;
    node.data = updateNodeData(node.data, { layout: nextLayout });
    treeStorage.cacheTree(tree);
  },

  async [RPC_METHOD.SET_NODE_LAYOUT_BATCH](message) {
    const tree = await treeStorage.getOrCreateTree();
    let changed = false;

    for (const layoutUpdate of message.layouts) {
      const node = tree.findNodeById(layoutUpdate.nodeId);
      if (!node) continue;

      const hasChanges =
        typeof layoutUpdate.offsetX === "number" || typeof layoutUpdate.offsetY === "number";
      if (!hasChanges) continue;

      const existingLayout = node.data.layout ?? { offsetX: 0, offsetY: 0 };
      const nextLayout = {
        offsetX:
          typeof layoutUpdate.offsetX === "number" ? layoutUpdate.offsetX : existingLayout.offsetX,
        offsetY:
          typeof layoutUpdate.offsetY === "number" ? layoutUpdate.offsetY : existingLayout.offsetY,
      };

      node.data = updateNodeData(node.data, { layout: nextLayout });
      changed = true;
    }

    if (!changed) return;

    treeStorage.cacheTree(tree);
  },

  async [RPC_METHOD.RESET_NODE_LAYOUTS]() {
    const tree = await treeStorage.getOrCreateTree();
    let changed = false;
    for (const node of tree.iter() ?? []) {
      if (node.data.layout) {
        const { layout: _layout, ...rest } = node.data;
        node.data = rest as typeof node.data;
        changed = true;
      }
    }
    if (!changed) return;
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, "layout");
  },
});
