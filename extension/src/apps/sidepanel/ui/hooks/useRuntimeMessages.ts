import { useEffect, useRef } from "react";
import { useStore } from "../state/store.js";
import { maybeShowFirstPruneToast, showUiToast } from "../notifications/sonner-adapter.js";
import { listTombstones } from "../../api/cleanup.js";
import { browser } from "@shared/platform/webext.js";
import { EXTENSION_MESSAGE, onExtensionMessage } from "@shared/transport/extension-messaging.js";

export function useRuntimeMessages(): void {
  const applyTreeState = useStore((state) => state.applyTreeState);
  const setCommandState = useStore((state) => state.setCommandState);
  const setEditorMode = useStore((state) => state.setEditorMode);
  const setTrees = useStore((state) => state.setTrees);
  const setSyncStatus = useStore((state) => state.setSyncStatus);
  const setAuthState = useStore((state) => state.setAuthState);
  const setSyncConflict = useStore((state) => state.setSyncConflict);
  const setRecentlyCleanedOpen = useStore((state) => state.setRecentlyCleanedOpen);
  const lastTombstoneCount = useRef<number | null>(null);

  useEffect(() => {
    const removeTreeUpdated = onExtensionMessage(EXTENSION_MESSAGE.TREE_UPDATED, ({ data }) => {
      applyTreeState(data);
      setCommandState(data.commandState);

      if (data.reason === "editor-enter") {
        setEditorMode({ active: true, treeId: null });
      } else if (data.reason === "editor-exit") {
        setEditorMode({ active: false, treeId: null });
      }

      // Watch for the first time the tombstone list becomes non-empty
      // and fire a one-time onboarding toast. We poll via the RPC here
      // rather than subscribing to a dedicated event because the
      // silent-prune path doesn't broadcast anything extra — but a
      // prune implies a later navigation, which does.
      void listTombstones()
        .then((list) => {
          const count = list.length;
          const prev = lastTombstoneCount.current;
          lastTombstoneCount.current = count;
          if (prev === null || count <= prev) return;
          void maybeShowFirstPruneToast(count, {
            onView: () => setRecentlyCleanedOpen(true),
            onOpenSettings: () => {
              const url = chrome.runtime.getURL("settings.html#behavior");
              browser.tabs.create({ url, active: true }).catch((error) => {
                console.error("Failed to open Behavior settings:", error);
              });
            },
          });
        })
        .catch(() => {
          /* non-fatal */
        });
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
    setRecentlyCleanedOpen,
  ]);
}
