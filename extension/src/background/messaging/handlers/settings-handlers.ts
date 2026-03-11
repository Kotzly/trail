import { settingsManager } from '../../services/settings.js';
import { RPC_METHOD, defineRpcHandlers, ok } from '@shared/rpc/contracts.js';

export const settingsHandlers = defineRpcHandlers({
  async [RPC_METHOD.GET_SETTINGS]() {
    return ok(settingsManager.get());
  },

  async [RPC_METHOD.SAVE_SETTINGS](message) {
    await settingsManager.patch(message.settings);
    return ok();
  },
});
