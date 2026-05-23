import { useEffect, useState } from "react";
import { getAuthState, initAuth, subscribeAuthState, type AuthState } from "./index.js";

let initPromise: Promise<AuthState> | null = null;

function ensureInit(): Promise<AuthState> {
  if (!initPromise) initPromise = initAuth();
  return initPromise;
}

/**
 * Track Supabase auth state in any React surface. Idempotent per-surface:
 * the underlying `initAuth()` is kicked off once, then every consumer
 * subscribes to `subscribeAuthState` for live updates.
 *
 * Returns the current `AuthState`. Until the first orchestrator notify
 * resolves, this is `{ status: "signed-out" }` — render accordingly.
 */
export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>(() => getAuthState());

  useEffect(() => {
    let active = true;
    void ensureInit().then((next) => {
      if (active) setState(next);
    });
    const unsub = subscribeAuthState((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return state;
}
