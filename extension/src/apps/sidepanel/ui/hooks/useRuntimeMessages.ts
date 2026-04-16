import { useEffect } from "react";
import { getCommandState } from "../../api/commands.js";
import { useStore } from "../state/store.js";
import { showUiToast } from "../notifications/sonner-adapter.js";
import { EXTENSION_MESSAGE, onExtensionMessage } from "@shared/transport/extension-messaging.js";

export function useRuntimeMessages(): void {
  const applyTreeState = useStore((state) => state.applyTreeState);
  const setCommandState = useStore((state) => state.setCommandState);
  const setEditorMode = useStore((state) => state.setEditorMode);
  const setTrees = useStore((state) => state.setTrees);
  const setSyncStatus = useStore((state) => state.setSyncStatus);
  const setAuthState = useStore((state) => state.setAuthState);
  const setSyncConflict = useStore((state) => state.setSyncConflict);

  useEffect(() => {
    const removeTreeUpdated = onExtensionMessage(EXTENSION_MESSAGE.TREE_UPDATED, ({ data }) => {
      applyTreeState(data);

      if (data.reason === "editor-enter") {
        setEditorMode({ active: true, treeId: null });
      } else if (data.reason === "editor-exit") {
        setEditorMode({ active: false, treeId: null });
      }

      void getCommandState()
        .then((state) => setCommandState(state))
        .catch((error) => console.error("Failed to fetch command state:", error));
    });
    const removeTreesUpdated = onExtensionMessage(EXTENSION_MESSAGE.TREES_UPDATED, ({ data }) => {
      setTrees({ active: data.active, archived: data.archived });
    });
    const removeNotify = onExtensionMessage(EXTENSION_MESSAGE.UI_NOTIFY, ({ data }) => {
      showUiToast(data);
    });
    const removeSyncStatus = onExtensionMessage(EXTENSION_MESSAGE.SYNC_STATUS, ({ data }) => {
      // Map engine statuses to the sidepanel's narrower SyncStatus enum.
      if (data.status === "offline") {
        setSyncStatus("error");
      } else {
        setSyncStatus(data.status);
      }
    });
    const removeAuthState = onExtensionMessage(EXTENSION_MESSAGE.AUTH_STATE, ({ data }) => {
      setAuthState(data);
    });
    const removeSyncConflict = onExtensionMessage(EXTENSION_MESSAGE.SYNC_CONFLICT, ({ data }) => {
      setSyncConflict(data);
    });

    return () => {
      removeTreeUpdated();
      removeTreesUpdated();
      removeNotify();
      removeSyncStatus();
      removeAuthState();
      removeSyncConflict();
    };
  }, [
    applyTreeState,
    setCommandState,
    setEditorMode,
    setTrees,
    setSyncStatus,
    setAuthState,
    setSyncConflict,
  ]);
}
