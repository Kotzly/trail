import { useEffect } from "react";
import { RPC_METHOD, type RequestMessage } from "@shared/rpc/contracts.js";
import { getCommandState } from "../../api/commands.js";
import { useStore } from "../state/store.js";
import { showUiToast } from "../notifications/sonner-adapter.js";
import { browser } from "@shared/platform/webext.js";

export function useRuntimeMessages(): void {
  const applyTreeState = useStore((state) => state.applyTreeState);
  const setCommandState = useStore((state) => state.setCommandState);
  const setEditorMode = useStore((state) => state.setEditorMode);
  const setTrees = useStore((state) => state.setTrees);

  useEffect(() => {
    const handler = (message: RequestMessage) => {
      if (message.type === RPC_METHOD.TREE_UPDATED) {
        applyTreeState(message);

        // Sync editor mode state from tree update reason
        if (message.reason === "editor-enter") {
          // The treeId is conveyed by the background; for now derive from the
          // current tree's root or leave as null until a direct update.
          setEditorMode({ active: true, treeId: null });
        } else if (message.reason === "editor-exit") {
          setEditorMode({ active: false, treeId: null });
        }

        getCommandState()
          .then((state) => setCommandState(state))
          .catch((error) => console.error("Failed to fetch command state:", error));
        return;
      }
      if (message.type === RPC_METHOD.TREES_UPDATED) {
        setTrees({ active: message.active, archived: message.archived });
        return;
      }
      if (message.type === RPC_METHOD.NOTIFY) {
        showUiToast(message.notification);
      }
    };

    browser.runtime.onMessage.addListener(handler);
    return () => {
      browser.runtime.onMessage.removeListener(handler);
    };
  }, [applyTreeState, setCommandState, setEditorMode, setTrees]);
}
