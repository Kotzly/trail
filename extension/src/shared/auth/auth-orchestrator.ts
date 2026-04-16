/**
 * Auth orchestrator — runs in every surface, wraps supabase-js.
 *
 * Sign-in flow (MV3 extension, third-party Google OAuth via Supabase):
 *   1. `supabase.auth.signInWithOAuth({ provider: 'google', options: {
 *        redirectTo: chrome.identity.getRedirectURL(), skipBrowserRedirect: true
 *      }})` returns an auth URL (Supabase → Google).
 *   2. We feed that URL to `chrome.identity.launchWebAuthFlow`, which opens a
 *      popup window, lets Google + Supabase do the dance, and redirects to
 *      `https://<extension-id>.chromiumapp.org/#access_token=…`.
 *   3. Chrome hands us the final URL; we extract tokens and call
 *      `supabase.auth.setSession`.
 *   4. Supabase persists session via our chrome.storage adapter (see
 *      `src/shared/lib/supabase.ts`).
 *
 * Google OAuth client_id + secret are configured INSIDE Supabase Dashboard,
 * not in this code. Supabase is the OAuth client.
 */

import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@shared/lib/supabase.js";
import { authIdentityItem, deviceIdItem, type AuthIdentity } from "@shared/config/storage-items.js";
import { captureError, captureEvent, resetTelemetryIdentity } from "@shared/lib/observability.js";
import { createLogger } from "@shared/lib/logger.js";

const log = createLogger("auth");

export type AuthState =
  | { status: "unconfigured" }
  | { status: "signed-out" }
  | { status: "signed-in"; identity: AuthIdentity };

let cachedState: AuthState | null = null;
const listeners = new Set<(state: AuthState) => void>();

async function ensureDeviceId(): Promise<string> {
  const existing = await deviceIdItem.getValue();
  if (existing) return existing;
  const next = crypto.randomUUID();
  await deviceIdItem.setValue(next);
  return next;
}

function sessionToIdentity(session: Session | null): AuthIdentity | null {
  if (!session?.user) return null;
  const meta = session.user.user_metadata ?? {};
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    displayName:
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      session.user.email ||
      null,
    avatarUrl: (typeof meta.avatar_url === "string" && meta.avatar_url) || null,
  };
}

function notify(state: AuthState): void {
  cachedState = state;
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

/**
 * Call once per surface. Safe to call more than once (second call is a
 * no-op beyond ensuring cached state is fresh).
 */
export async function initAuth(): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    notify({ status: "unconfigured" });
    return { status: "unconfigured" };
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    notify({ status: "unconfigured" });
    return { status: "unconfigured" };
  }

  await ensureDeviceId();

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const identity = sessionToIdentity(data.session);
    if (identity) {
      await authIdentityItem.setValue(identity);
      notify({ status: "signed-in", identity });
    } else {
      notify({ status: "signed-out" });
    }
  } catch (error) {
    captureError(error, { kind: "auth_get_session" });
    notify({ status: "signed-out" });
  }

  // Keep cached identity in sync with Supabase's internal auth state.
  supabase.auth.onAuthStateChange(async (_event, session) => {
    const identity = sessionToIdentity(session);
    if (identity) {
      await authIdentityItem.setValue(identity);
      notify({ status: "signed-in", identity });
    } else {
      await authIdentityItem.setValue(null);
      notify({ status: "signed-out" });
    }
  });

  return cachedState ?? { status: "signed-out" };
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
 * Sign in with Google via Supabase OAuth, mediated by
 * `chrome.identity.launchWebAuthFlow`. Must be called from a UI surface
 * (sidepanel or settings) — the service worker cannot launch the popup.
 */
export async function signInWithGoogle(): Promise<AuthState> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }
  if (!chrome.identity?.launchWebAuthFlow) {
    throw new Error("chrome.identity not available in this surface");
  }

  const redirectUrl = chrome.identity.getRedirectURL();
  captureEvent("auth_signin_started", { provider: "google" });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) {
    throw error ?? new Error("Supabase did not return an auth URL");
  }

  const responseUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true }, (result) => {
      const lastErr = chrome.runtime.lastError;
      if (lastErr) {
        reject(new Error(lastErr.message ?? "launchWebAuthFlow failed"));
        return;
      }
      if (!result) {
        reject(new Error("Empty auth flow response"));
        return;
      }
      resolve(result);
    });
  });

  // Supabase appends tokens in the fragment.
  const hash = new URL(responseUrl).hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) {
    throw new Error("No tokens in auth response — check Supabase URL configuration");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) throw sessionError;

  const identity = sessionToIdentity(sessionData.session);
  if (!identity) throw new Error("Signed in but session has no user identity");

  await authIdentityItem.setValue(identity);
  captureEvent("auth_signin_completed", { provider: "google" });
  notify({ status: "signed-in", identity });
  return { status: "signed-in", identity };
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch (error) {
    captureError(error, { kind: "auth_signout" });
  }
  await authIdentityItem.setValue(null);
  captureEvent("auth_signout");
  await resetTelemetryIdentity();
  notify({ status: "signed-out" });
}
