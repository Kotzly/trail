import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "../state/store.js";
import { EXTENSION_MESSAGE, onExtensionMessage } from "@shared/transport/extension-messaging.js";

/**
 * Listens for AUTH_TRANSITION (sign-out, account switch) and clears the
 * React Query bootstrap cache + Zustand per-user slice. Without this
 * the sidepanel keeps showing the previous user's trees because
 * `useBootstrap`'s queries use `staleTime: Infinity` and Zustand state
 * is only updated when a TREE_UPDATED message arrives from the SW —
 * which doesn't happen on sign-out.
 */
export function useAuthReset(): void {
  const queryClient = useQueryClient();
  const resetForAuth = useStore((s) => s.resetForAuth);

  useEffect(() => {
    const remove = onExtensionMessage(EXTENSION_MESSAGE.AUTH_TRANSITION, () => {
      queryClient.clear();
      resetForAuth();
    });
    return () => {
      remove();
    };
  }, [queryClient, resetForAuth]);
}
