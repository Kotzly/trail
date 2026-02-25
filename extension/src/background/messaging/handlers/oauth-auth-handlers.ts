import { RPC_METHOD, defineRpcHandlers, ok } from "../../../shared/rpc/contracts.js";
import { authOrchestrator } from "../../services/auth-orchestrator.js";

export const oauthAuthHandlers = defineRpcHandlers({
  async [RPC_METHOD.OAUTH_INTERACTIVE_LOGIN]() {
    const result = await authOrchestrator.interactiveLogin();
    return ok({
      ok: result.ok,
      reason: result.reason,
    });
  },
  async [RPC_METHOD.OAUTH_SILENT_SYNC]() {
    const result = await authOrchestrator.silentSync();
    return ok({
      ok: result.ok,
      reason: result.reason,
    });
  },
});
