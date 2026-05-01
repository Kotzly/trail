import { RPC_METHOD, defineRpcHandlers } from "@shared/rpc/contracts.js";
import { treeStorage } from "../../services/tree-storage.js";
import { notifyTreeUpdate } from "../notifications.js";
import { CommandManager } from "@shared/lib/commands.js";
import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import type { Description } from "@shared/types/ids.js";

export const pinHandlers = defineRpcHandlers({
  async [RPC_METHOD.TOGGLE_PIN](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) throw new Error("Node not found");

    CommandManager.saveSnapshot(NavigationTreeMapper.toJSON(tree), "Toggle pin" as Description);
    node.data.pinned = !node.data.pinned;
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, "pins");
  },

  async [RPC_METHOD.BULK_PIN](message) {
    const tree = await treeStorage.getOrCreateTree();
    CommandManager.saveSnapshot(NavigationTreeMapper.toJSON(tree), "Pin nodes" as Description);
    for (const id of message.nodeIds) {
      const node = tree.findNodeById(id);
      if (node) node.data.pinned = true;
    }
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, "pins");
  },

  async [RPC_METHOD.BULK_UNPIN](message) {
    const tree = await treeStorage.getOrCreateTree();
    CommandManager.saveSnapshot(NavigationTreeMapper.toJSON(tree), "Unpin nodes" as Description);
    for (const id of message.nodeIds) {
      const node = tree.findNodeById(id);
      if (node) node.data.pinned = false;
    }
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, "pins");
  },
});
