/**
 * Auth session lifecycle + module-level singleton state.
 *
 * Every other orchestrator submodule reads/writes the singletons here
 * via the exported accessors — DO NOT duplicate `cachedState`,
 * `listeners`, `recoveryInProgress`, etc. in another module or
 * subscribers will receive split-brain state.
 */

import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@shared/lib/supabase.js";
import { authIdentityItem, deviceIdItem, type AuthIdentity } from "@shared/config/storage-items.js";
import { createLogger } from "@shared/lib/logger.js";
import { EXTENSION_MESSAGE, fireExtensionEvent } from "@shared/transport/extension-messaging.js";

export const log = createLogger("auth");

export type AuthState =
  | { status: "unconfigured" }
  | { status: "signed-out" }
  | { status: "signed-in"; identity: AuthIdentity };

export type EmailOtpType = "email" | "signup" | "recovery";

export type SignUpResult =
  | { status: "signed-in"; identity: AuthIdentity }
  | { status: "awaiting-confirmation"; email: string };

// ---------------------------------------------------------------------------
// Singleton state — accessed via exported helpers below
// ---------------------------------------------------------------------------

let cachedState: AuthState | null = null;
const listeners = new Set<(state: AuthState) => void>();
const transitionListeners = new Set<() => void>();

let authReadyResolve: ((state: AuthState) => void) | null = null;
/**
 * Resolves on the first `notify(...)` call. Background message handlers
 * for `getTreeState` / `getTrees` `await` this so a cold service worker
 * doesn't serve the previous user's tree before `initAuth()` resolves.
 */
export const authReady: Promise<AuthState> = new Promise<AuthState>((resolve) => {
  authReadyResolve = resolve;
});

/**
 * While true, the orchestrator suppresses `signed-in` broadcasts even
 * though Supabase has issued a temporary recovery session. This keeps
 * the sign-in UI mounted long enough for the user to choose a new
 * password — without it, listeners flip to `signed-in` the instant the
 * recovery OTP is verified and the "set new password" form unmounts.
 */
let recoveryInProgress = false;
let pendingRecoveryIdentity: AuthIdentity | null = null;

export function isRecoveryInProgress(): boolean {
  return recoveryInProgress;
}

export function setRecoveryInProgress(value: boolean): void {
  recoveryInProgress = value;
}

export function getPendingRecoveryIdentity(): AuthIdentity | null {
  return pendingRecoveryIdentity;
}

export function setPendingRecoveryIdentity(identity: AuthIdentity | null): void {
  pendingRecoveryIdentity = identity;
}

// ---------------------------------------------------------------------------
// State broadcast
// ---------------------------------------------------------------------------

export function notify(state: AuthState): void {
  cachedState = state;
  if (authReadyResolve) {
    const resolve = authReadyResolve;
    authReadyResolve = null;
    resolve(state);
  }
  listeners.forEach((cb) => {
    try {
      cb(state);
    } catch (error) {
      log.error("auth listener threw", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

export function getCachedState(): AuthState | null {
  return cachedState;
}

export function getAuthState(): AuthState {
  return cachedState ?? { status: "signed-out" };
}

export function subscribeAuthState(cb: (state: AuthState) => void): () => void {
  listeners.add(cb);
  if (cachedState) cb(cachedState);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Subscribe to in-process "per-user state must be invalidated" signals.
 * Fired from the wipe path (account switch, sign-out). Distinct from
 * `subscribeAuthState`: that broadcasts identity, this broadcasts
 * "drop your caches now". Sync engine, tree-storage in-memory caches,
 * and sidepanel UI all subscribe.
 */
export function subscribeAuthTransition(cb: () => void): () => void {
  transitionListeners.add(cb);
  return () => {
    transitionListeners.delete(cb);
  };
}

export function fireAuthTransition(
  reason: "signed-out" | "account-switched" | "first-signin",
): void {
  transitionListeners.forEach((cb) => {
    try {
      cb();
    } catch (error) {
      log.error("auth transition listener threw", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
  // Cross-context broadcast for UI surfaces (sidepanel/settings/login)
  // to drop their queryClient + Zustand caches. The SW is also a
  // subscriber of this message — harmless duplicate, idempotent.
  fireExtensionEvent(EXTENSION_MESSAGE.AUTH_TRANSITION, { reason });
}

// ---------------------------------------------------------------------------
// Session → identity helpers
// ---------------------------------------------------------------------------

export function sessionToIdentity(session: Session | null): AuthIdentity | null {
  if (!session?.user) return null;
  const meta = session.user.user_metadata ?? {};
  const rawProvider =
    (typeof session.user.app_metadata?.provider === "string" &&
      session.user.app_metadata.provider) ||
    session.user.identities?.[0]?.provider ||
    null;
  const provider: AuthIdentity["provider"] =
    rawProvider === "google"
      ? "google"
      : rawProvider === "github"
        ? "github"
        : rawProvider === "email"
          ? "email"
          : "other";
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    displayName:
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      session.user.email ||
      null,
    avatarUrl: (typeof meta.avatar_url === "string" && meta.avatar_url) || null,
    provider,
  };
}

export function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Cloud sync isn't configured in this build of Trail. Your trees stay local-only.",
    );
  }
  return supabase;
}

// ---------------------------------------------------------------------------
// Device id (used by both provisioning and the initAuth path)
// ---------------------------------------------------------------------------

export async function ensureDeviceId(): Promise<string> {
  const existing = await deviceIdItem.getValue();
  if (existing) return existing;
  const next = crypto.randomUUID();
  await deviceIdItem.setValue(next);
  return next;
}

/**
 * Persist the identity locally. Centralised so the four entry points
 * (initAuth, OAuth, email+password, OTP) share a single side-effect.
 */
export async function persistIdentity(identity: AuthIdentity | null): Promise<void> {
  await authIdentityItem.setValue(identity);
}
