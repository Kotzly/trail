import { RPC_METHOD, defineRpcHandlers, ok, err } from '../../../shared/rpc/contracts.js';
import { treeStorage } from '../../services/tree-storage.js';
import { notifyTreeUpdate } from '../notifications.js';
import { CommandManager } from '../../../shared/lib/commands.js';
import { NavigationTreeMapper } from '../../../shared/lib/mapper.js';
import { tabManager } from '../../state/tab-manager.js';
import type { NavigationTree } from '../../state/nav-tree.js';
import { syncOpenTabs } from '../../tabs/sync-open-tabs.js';
import { getEditorState } from './editor-handlers.js';
import { editorSyncMarkDirty } from '../../services/editor-sync.js';


async function applyTree(json: ReturnType<typeof NavigationTreeMapper.toJSON>): Promise<void> {
  const tree = NavigationTreeMapper.fromJSON(json);
  await syncOpenTabs();
  treeStorage.cacheTree(tree);
  await notifyTreeUpdate(tree, 'undo');

  // In editor mode, mark cloud sync dirty so the change is PATCHed.
  // flushSaveNow() still runs but is a no-op for non-active trees (guard).
  if (getEditorState().active) {
    editorSyncMarkDirty();
  }

  await treeStorage.flushSaveNow();
}

export const commandHandlers = defineRpcHandlers({
  async [RPC_METHOD.COMMAND_STATE]() {
    return ok(CommandManager.getState());
  },

  async [RPC_METHOD.UNDO]() {
    if (!CommandManager.canUndo()) return ok(CommandManager.getState());
    const tree = await treeStorage.getOrCreateTree();
    const current = NavigationTreeMapper.toJSON(tree);
    const previous = CommandManager.undo(current);
    if (!previous) return ok(CommandManager.getState());

    await applyTree(previous);
    return ok(CommandManager.getState());
  },

  async [RPC_METHOD.REDO]() {
    if (!CommandManager.canRedo()) return ok(CommandManager.getState());
    const tree = await treeStorage.getOrCreateTree();
    const current = NavigationTreeMapper.toJSON(tree);
    const next = CommandManager.redo(current);
    if (!next) return ok(CommandManager.getState());

    await applyTree(next);
    return ok(CommandManager.getState());
  },
});
