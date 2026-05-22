import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getAuthState, subscribeAuthState, type AuthState } from "@shared/auth/index.js";

/**
 * Fires a sonner toast when auth transitions from signed-out to signed-in
 * (the user just completed login in the dedicated tab). The initial mount
 * is skipped — we only want to announce new transitions, not restored state.
 */
export function useAuthTransitionToast(): void {
  const prevStatusRef = useRef<AuthState["status"] | null>(null);

  useEffect(() => {
    prevStatusRef.current = getAuthState().status;
    const unsub = subscribeAuthState((next) => {
      const prev = prevStatusRef.current;
      prevStatusRef.current = next.status;
      if (prev === "signed-in" || next.status !== "signed-in") return;
      const name = next.identity.displayName ?? next.identity.email ?? "you";
      toast.success(`Signed in as ${name}`, {
        description: "Your trees will start syncing across devices.",
      });
    });
    return unsub;
  }, []);
}
