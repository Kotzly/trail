import { getAllFlags, setFlagOverride, resetAllFlags } from "../../services/flags.js";
import { RPC_METHOD, defineRpcHandlers, ok } from "@shared/rpc/contracts.js";
import type { FlagKey, FlagValue } from "@shared/types/flags.js";

export const flagsHandlers = defineRpcHandlers({
  async [RPC_METHOD.GET_FLAGS]() {
    return ok(getAllFlags());
  },

  async [RPC_METHOD.SET_FLAG](message) {
    await setFlagOverride(message.key as FlagKey, message.value as FlagValue<FlagKey>);
    return ok(getAllFlags());
  },

  async [RPC_METHOD.RESET_FLAGS]() {
    await resetAllFlags();
    return ok(getAllFlags());
  },
});
