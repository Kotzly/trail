import { settingsManager } from '../../services/settings.js';
import { treeStorage } from '../../services/tree-storage.js';
import { notifyTreeUpdate } from '../notifications.js';
import { notifyUi } from '../ui-notifications.js';
import { MSG, defineHandlers, ok } from '../../../shared/types/messages.js';

export const settingsHandlers = defineHandlers({
  async [MSG.GET_SETTINGS]() {
    return ok(settingsManager.get());
  },

  async [MSG.SAVE_SETTINGS](message) {
    const prev = settingsManager.get();
    await settingsManager.patch(message.settings);
    const next = settingsManager.get();
    if (prev.capacity !== next.capacity) {
      const tree = await treeStorage.getOrCreateTree();
      const evicted = tree.setCapacity(next.capacity);
      tree.consumeEvictedCount();
      if (evicted > 0) {
        notifyUi({
          message: `Evicted ${evicted} node${evicted === 1 ? '' : 's'} due to capacity`,
          icon: 'AlertTriangle',
          durationMs: 5000,
        });
      }
      treeStorage.cacheTree(tree);
      await notifyTreeUpdate(tree, 'sync');
    }
    return ok();
  },
});
