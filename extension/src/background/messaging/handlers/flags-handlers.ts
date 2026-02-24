import { flagManager } from '../../services/flags.js';
import { RPC_METHOD, defineRpcHandlers, ok } from '../../../shared/rpc/contracts.js';
import type { FlagKey, FlagValue } from '../../../shared/types/flags.js';

export const flagsHandlers = defineRpcHandlers({
  async [RPC_METHOD.GET_FLAGS]() {
    return ok(flagManager.getAll());
  },

  async [RPC_METHOD.SET_FLAG](message) {
    await flagManager.setOverride(
      message.key as FlagKey,
      message.value as FlagValue<FlagKey>,
    );
    return ok(flagManager.getAll());
  },

  async [RPC_METHOD.RESET_FLAGS]() {
    await flagManager.resetAll();
    return ok(flagManager.getAll());
  },
});
