import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { subscribeAuthState, type AuthState } from "@shared/auth/index.js";

/**
 * Fires a sonner toast when auth transitions from signed-out to signed-in
 * (the user just completed login in the dedicated tab). The first emission
 * the hook sees after mount is treated as the baseline — `getAuthState()`
 * can't be used to seed it because the orchestrator returns "signed-out"
 * before its first `notify(...)` lands, which would falsely report a
 * restored signed-in session as a fresh transition.
 */
export function useAuthTransitionToast(): void {
  const prevStatusRef = useRef<AuthState["status"] | null>(null);

  useEffect(() => {
    const unsub = subscribeAuthState((next) => {
      const prev = prevStatusRef.current;
      prevStatusRef.current = next.status;
      if (prev === null) return;
      if (prev === "signed-in" || next.status !== "signed-in") return;
      const name = next.identity.displayName ?? next.identity.email ?? "you";
      toast.success(`Signed in as ${name}`, {
        description: "Your trees will start syncing across devices.",
      });
    });
    return unsub;
  }, []);
}
