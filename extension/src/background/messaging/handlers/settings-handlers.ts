import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import { settingsManager } from "../../services/settings.js";
import { treeStorage } from "../../services/tree-storage.js";
import { RPC_METHOD, defineRpcHandlers, ok } from "@shared/rpc/contracts.js";
import { requestLayoutRefinement } from "../notifications.js";

export const settingsHandlers = defineRpcHandlers({
  async [RPC_METHOD.GET_SETTINGS]() {
    return ok(settingsManager.get());
  },

  async [RPC_METHOD.SAVE_SETTINGS](message) {
    const prev = settingsManager.get();
    await settingsManager.patch(message.settings);
    const next = settingsManager.get();

    const layoutChanged =
      prev.layout.mode !== next.layout.mode || prev.graphDensity !== next.graphDensity;

    if (layoutChanged) {
      const tree = await treeStorage.getOrCreateTree();
      requestLayoutRefinement(NavigationTreeMapper.toJSON(tree));
    }

    return ok();
  },
});
