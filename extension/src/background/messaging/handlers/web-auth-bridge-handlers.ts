import {
  RPC_METHOD,
  defineRpcHandlers,
  err,
  ok,
} from "../../../shared/rpc/contracts.js";
import { requestWebAuthBridgeCodeFromSiteTabs } from "../site-relay.js";

export const webAuthBridgeHandlers = defineRpcHandlers({
  async [RPC_METHOD.REQUEST_WEB_AUTH_BRIDGE_CODE]() {
    const bridgeCode = await requestWebAuthBridgeCodeFromSiteTabs();
    if (!bridgeCode) {
      return err("not_found");
    }

    return ok({
      code: bridgeCode.code,
      expiresAt: bridgeCode.expiresAt,
    });
  },
});
