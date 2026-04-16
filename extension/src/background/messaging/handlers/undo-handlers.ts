import { RPC_METHOD, defineRpcHandlers } from "@shared/rpc/contracts.js";
import { treeStorage } from "../../services/tree-storage.js";
import { notifyTreeUpdate } from "../notifications.js";
import { CommandManager } from "@shared/lib/commands.js";
import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import { syncOpenTabs } from "../../tabs/sync-open-tabs.js";
async function applyTree(json: ReturnType<typeof NavigationTreeMapper.toJSON>): Promise<void> {
  const tree = NavigationTreeMapper.fromJSON(json);
  await syncOpenTabs();
  treeStorage.cacheTree(tree);
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
