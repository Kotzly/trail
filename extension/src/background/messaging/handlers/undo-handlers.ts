import { MSG, defineHandlers, ok, err } from '../../../shared/types/messages.js';
import { treeStorage } from '../../services/tree-storage.js';
import { notifyTreeUpdate } from '../notifications.js';
import { CommandManager } from '../../../shared/lib/commands.js';
import { NavigationTreeMapper } from '../../../shared/lib/mapper.js';
import { tabManager } from '../../state/tab-manager.js';
import type { NavigationTree } from '../../state/nav-tree.js';
import { syncOpenTabs } from '../../tabs/sync-open-tabs.js';


async function applyTree(json: ReturnType<typeof NavigationTreeMapper.toJSON>): Promise<void> {
  const tree = NavigationTreeMapper.fromJSON(json);
  syncOpenTabs();
  treeStorage.cacheTree(tree);
  await notifyTreeUpdate(tree, 'undo');
  await treeStorage.flushSaveNow();
}

export const commandHandlers = defineHandlers({
  async [MSG.COMMAND_STATE]() {
    return ok(CommandManager.getState());
  },

  async [MSG.UNDO]() {
    if (!CommandManager.canUndo()) return err('No undo available');
    const tree = await treeStorage.getOrCreateTree();
    const current = NavigationTreeMapper.toJSON(tree);
    const previous = CommandManager.undo(current);
    if (!previous) return ok(CommandManager.getState());

    await applyTree(previous);
    return ok(CommandManager.getState());
  },

  async [MSG.REDO]() {
    if (!CommandManager.canRedo()) return err('No redo available');
    const tree = await treeStorage.getOrCreateTree();
    const current = NavigationTreeMapper.toJSON(tree);
    const next = CommandManager.redo(current);
    if (!next) return ok(CommandManager.getState());

    await applyTree(next);
    return ok(CommandManager.getState());
  },
});
