import { RPC_METHOD, defineRpcHandlers } from "@shared/rpc/contracts.js";
import { treeStorage, withTreeLock } from "../../services/tree-storage.js";
import { notifyTreeUpdate } from "../notifications.js";
import { CommandManager } from "@shared/lib/commands.js";
import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import { tabManager } from "../../state/tab-manager.js";
async function applyTree(json: ReturnType<typeof NavigationTreeMapper.toJSON>): Promise<void> {
  const tree = NavigationTreeMapper.fromJSON(json);

  // Cache the restored tree FIRST so any reader under the lock sees
  // the new shape. Previously syncOpenTabs ran before cacheTree,
  // meaning syncOpenTabs saw the OLD (pre-undo) tree and registered
  // tabs against nodes that were about to disappear (#19).
  await withTreeLock(async () => {
    treeStorage.cacheTree(tree);
    // Reconcile tabManager against the new tree: drop mappings whose
    // node no longer exists, keep the rest. Beats the previous
    // tabManager.reset() in syncOpenTabs which blew away every
    // mapping and rebuilt only those whose URL happened to match.
    const openNodes = [...tabManager.openNodes()];
    for (const nodeId of openNodes) {
      if (!tree.findNodeById(nodeId)) {
        const tabs = tabManager.tabsByNode(nodeId);
        for (const tabId of [...tabs]) tabManager.unregister(tabId);
      }
    }
    // Re-wire the onNodesDeleted subscription to the new tree
    // instance (the hydrator creates a fresh tree with no listeners).
    tree.onNodesDeleted((ids) => tabManager.onNodesDeleted(ids));
  });
  await notifyTreeUpdate(tree, "undo");
  await treeStorage.flushSaveNow();
}

export const commandHandlers = defineRpcHandlers({
  async [RPC_METHOD.COMMAND_STATE]() {
    return CommandManager.getState();
  },

  async [RPC_METHOD.UNDO]() {
    if (!CommandManager.canUndo()) return CommandManager.getState();
    const tree = await treeStorage.getOrCreateTree();
    const current = NavigationTreeMapper.toJSON(tree);
    const previous = CommandManager.undo(current);
    if (!previous) return CommandManager.getState();

    await applyTree(previous);
    return CommandManager.getState();
  },

  async [RPC_METHOD.REDO]() {
    if (!CommandManager.canRedo()) return CommandManager.getState();
    const tree = await treeStorage.getOrCreateTree();
    const current = NavigationTreeMapper.toJSON(tree);
    const next = CommandManager.redo(current);
    if (!next) return CommandManager.getState();

    await applyTree(next);
    return CommandManager.getState();
  },
});
