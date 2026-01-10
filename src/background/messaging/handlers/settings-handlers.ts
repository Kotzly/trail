import { settingsManager } from '../../services/settings.js';
import { MSG, defineHandlers, ok } from '../../../shared/types/messages.js';

export const settingsHandlers = defineHandlers({
  async [MSG.GET_SETTINGS]() {
    return ok(settingsManager.get());
  },

  async [MSG.SAVE_SETTINGS](message) {
    await settingsManager.patch(message.settings);
    return ok();
  },
});
