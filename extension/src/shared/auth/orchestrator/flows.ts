/**
 * High-level auth flows — the public entry points imported by every UI
 * surface (login, sidepanel, settings, background SW).
 *
 * Three sign-in flows are supported:
 *
 * 1. Third-party OAuth (Google, GitHub). MV3 extension uses
 *    `supabase.auth.signInWithOAuth({ provider, options: {
 *      redirectTo: chrome.identity.getRedirectURL(), skipBrowserRedirect: true
 *    }})` to obtain an auth URL. We feed it to
 *    `chrome.identity.launchWebAuthFlow`, parse the PKCE `code` from the
 *    redirect, and exchange it via `supabase.auth.exchangeCodeForSession`.
 *
 * 2. Email + password. Direct `signInWithPassword`. Sign-up creates an
 *    account; if the project requires email confirmation (recommended,
 *    and our default in `supabase/config.toml`), the returned session is
 *    `null` and the user must verify the 6-digit code from the
 *    confirmation email via `verifyEmailOtp(email, token, "signup")`.
 *
 * 3. Email + OTP (passwordless). `requestEmailOtp` calls
 *    `signInWithOtp({ email, options: { shouldCreateUser: false } })` —
 *    we deliberately set `shouldCreateUser: false` so the codepath
 *    cannot be used to silently provision unverified accounts.
 *
 * Magic links are NOT used: an extension cannot reliably catch the
 * link-click in a normal browser tab. 6-digit codes work everywhere.
 *
 * Supabase persists the session via `chrome.storage.local` so the
 * background service worker, sidepanel, and settings page share state
 * (see `src/shared/lib/supabase.ts`). The
 * `supabase.auth.onAuthStateChange` listener keeps the cached identity
 * current.
 */

import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@shared/lib/supabase.js";
import { authIdentityItem } from "@shared/config/storage-items.js";
import { captureError, captureEvent } from "@shared/lib/observability.js";
import {
  isAuthError,
  normalizeEmail,
  toUserError,
  validateEmail,
  validatePassword,
} from "./errors.js";
import {
  ensureDeviceId,
  getCachedState,
  isRecoveryInProgress,
  notify,
  persistIdentity,
  requireClient,
  sessionToIdentity,
  setPendingRecoveryIdentity,
  setRecoveryInProgress,
  type AuthState,
  type EmailOtpType,
  type SignUpResult,
} from "./session.js";
import { provisionSignedInUser } from "./provisioning.js";
import { runUserChangeWipeIfNeeded } from "./wipe.js";

// ---------------------------------------------------------------------------
// initAuth — bootstrap (called once per surface)
// ---------------------------------------------------------------------------

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
      await persistIdentity(identity);
      await provisionSignedInUser(identity);
      notify({ status: "signed-in", identity });
    } else {
      notify({ status: "signed-out" });
    }
  } catch (error) {
    captureError(error, { kind: "auth_get_session" });
    // Previously: any throw from getSession() → emit signed-out, which
    // bounces the sidepanel to the login screen on a network blip.
    // Distinguish fetch/network errors from real auth errors by keeping
    // the prior identity (if any) on network failures. Supabase's
    // getSession() throws a TypeError for network failures (fetch
    // rejection) and a structured error for real auth issues.
    // (closes P1.19)
    const isNetwork =
      error instanceof TypeError ||
      (error instanceof Error && /fetch|network|failed to fetch/i.test(error.message));
    if (isNetwork) {
      const existing = await authIdentityItem.getValue();
      if (existing) {
        notify({ status: "signed-in", identity: existing });
        return { status: "signed-in", identity: existing };
      }
    }
    notify({ status: "signed-out" });
  }

  // Keep cached identity in sync with Supabase's internal auth state.
  supabase.auth.onAuthStateChange(async (_event, session) => {
    const identity = sessionToIdentity(session);
    if (identity) {
      if (isRecoveryInProgress()) {
        // Hold the broadcast until the password change completes — see
        // the `recoveryInProgress` doc-comment above.
        setPendingRecoveryIdentity(identity);
        return;
      }
      await persistIdentity(identity);
      // Account-switch wipe MUST run before `notify` so the sync engine
      // (which subscribes via `subscribeAuthState`) doesn't kick off a
      // backfill against the previous user's local trees. It only does
      // chrome.storage I/O — no Supabase calls — so it's safe to await
      // here without tripping the navigator.locks deadlock that
      // forbids awaiting `provisionSignedInUser` (which talks to
      // Supabase) in this callback.
      await runUserChangeWipeIfNeeded(identity);
      // Fire-and-forget the *server-side* provisioning: awaiting that
      // inside an `onAuthStateChange` callback deadlocks supabase-js's
      // `navigator.locks` critical section — another context (SW or
      // sidepanel) steals the auth lock and the original caller's
      // sign-in rejects with "lock stolen". Explicit sign-in entry
      // points await provisioning themselves before broadcasting;
      // this handler exists for token refresh / cross-tab wakeups
      // where an eventual-consistent row is good enough.
      void provisionSignedInUser(identity);
      notify({ status: "signed-in", identity });
    } else {
      await persistIdentity(null);
      notify({ status: "signed-out" });
    }
  });

  // Cross-context bridge: `supabase.auth.onAuthStateChange` only fires
  // for events on the current client instance. When the login happens
  // in a separate tab, the service worker's supabase client never
  // hears about it and sync never starts. We watch the Supabase
  // session key in `chrome.storage.local` and re-evaluate the session
  // here so the listener above fires on the writer's behalf.
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    let settling = false;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      const touchedAuthKey = Object.keys(changes).some(
        (k) => k.startsWith("sb_") && k.endsWith("-auth-token"),
      );
      if (!touchedAuthKey || settling) return;
      settling = true;
      void (async () => {
        try {
          const { data } = await supabase.auth.getSession();
          const nextIdentity = sessionToIdentity(data.session);
          const current = getCachedState();
          const sameStatus =
            (current?.status === "signed-in" && nextIdentity) ||
            (current?.status === "signed-out" && !nextIdentity);
          if (sameStatus) return;
          if (nextIdentity) {
            if (isRecoveryInProgress()) {
              setPendingRecoveryIdentity(nextIdentity);
              return;
            }
            await persistIdentity(nextIdentity);
            await provisionSignedInUser(nextIdentity);
            notify({ status: "signed-in", identity: nextIdentity });
          } else {
            await persistIdentity(null);
            notify({ status: "signed-out" });
          }
        } catch (error) {
          captureError(error, { kind: "auth_storage_bridge" });
        } finally {
          settling = false;
        }
      })();
    });
  }

  return getCachedState() ?? { status: "signed-out" };
}

// ---------------------------------------------------------------------------
// Email + password
// ---------------------------------------------------------------------------

export async function signInWithEmailPassword(
  emailRaw: string,
  password: string,
): Promise<AuthState> {
  const supabase = requireClient();
  const email = normalizeEmail(emailRaw);
  const emailErr = validateEmail(email);
  if (emailErr) throw new Error(emailErr);
  if (!password) throw new Error("Password is required.");

  captureEvent("auth_signin_started", { provider: "password" });
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const identity = sessionToIdentity(data.session);
    if (!identity) throw new Error("Signed in but session has no user identity.");
    await persistIdentity(identity);
    await provisionSignedInUser(identity);
    captureEvent("auth_signin_completed", { provider: "password" });
    notify({ status: "signed-in", identity });
    return { status: "signed-in", identity };
  } catch (err) {
    captureEvent("auth_signin_failed", { provider: "password" });
    captureError(err, { kind: "auth_signin_password" });
    throw toUserError(err, "Sign-in failed.");
  }
}

export async function signUpWithEmailPassword(
  emailRaw: string,
  password: string,
): Promise<SignUpResult> {
  const supabase = requireClient();
  const email = normalizeEmail(emailRaw);
  const emailErr = validateEmail(email);
  if (emailErr) throw new Error(emailErr);
  const passwordErr = validatePassword(password);
  if (passwordErr) throw new Error(passwordErr);

  captureEvent("auth_signup_started", { provider: "password" });
  try {
    // `emailRedirectTo` is required by Supabase for the confirmation
    // template even though we never follow the link — the user types
    // the 6-digit code instead. Pointing it at the extension's redirect
    // URL prevents leakage to a default.
    const redirectTo = chrome.identity?.getRedirectURL?.();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });
    if (error) throw error;

    if (data.session && data.user) {
      // Confirmations disabled at the project level — user is already in.
      const identity = sessionToIdentity(data.session);
      if (!identity) throw new Error("Signed up but session has no user identity.");
      await persistIdentity(identity);
      await provisionSignedInUser(identity);
      captureEvent("auth_signup_completed", { provider: "password", confirmed: true });
      notify({ status: "signed-in", identity });
      return { status: "signed-in", identity };
    }

    // Confirmations enabled — Supabase has sent the user a 6-digit code.
    captureEvent("auth_signup_completed", { provider: "password", confirmed: false });
    return { status: "awaiting-confirmation", email };
  } catch (err) {
    captureEvent("auth_signup_failed", { provider: "password" });
    captureError(err, { kind: "auth_signup_password" });
    throw toUserError(err, "Sign-up failed.");
  }
}

// ---------------------------------------------------------------------------
// Email + OTP (passwordless)
// ---------------------------------------------------------------------------

/**
 * Send a 6-digit sign-in code to an existing user. `shouldCreateUser`
 * is false so this path cannot silently provision accounts. To prevent
 * email enumeration we deliberately swallow "user not found" /
 * "signups disabled" responses and always tell the caller "code sent" —
 * only true infrastructure errors (network, rate limit, malformed
 * request) are surfaced. Real users see a code; fake ones see the same
 * UI but never receive anything.
 */
export async function requestEmailOtp(emailRaw: string): Promise<{ email: string }> {
  const supabase = requireClient();
  const email = normalizeEmail(emailRaw);
  const emailErr = validateEmail(email);
  if (emailErr) throw new Error(emailErr);

  captureEvent("auth_otp_requested", { purpose: "signin" });
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      const code = isAuthError(error) ? error.code : undefined;
      const msg = error.message ?? "";
      const isEnumerationLeak =
        code === "otp_disabled" ||
        code === "user_not_found" ||
        code === "signup_disabled" ||
        /user not found|signups not allowed|signup.*disabled/i.test(msg);
      if (isEnumerationLeak) {
        captureError(error, { kind: "auth_otp_enumeration_swallowed" });
        return { email };
      }
      throw error;
    }
    return { email };
  } catch (err) {
    captureError(err, { kind: "auth_otp_request" });
    throw toUserError(err, "Couldn't send the code. Try again in a moment.");
  }
}

/**
 * Resend the signup confirmation OTP for a user who just signed up but
 * lost the original email.
 */
export async function resendSignupOtp(emailRaw: string): Promise<{ email: string }> {
  const supabase = requireClient();
  const email = normalizeEmail(emailRaw);
  const emailErr = validateEmail(email);
  if (emailErr) throw new Error(emailErr);

  captureEvent("auth_otp_requested", { purpose: "signup_resend" });
  try {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) throw error;
    return { email };
  } catch (err) {
    captureError(err, { kind: "auth_otp_resend_signup" });
    throw toUserError(err, "Couldn't resend the code. Try again in a moment.");
  }
}

export async function verifyEmailOtp(
  emailRaw: string,
  token: string,
  type: EmailOtpType,
): Promise<AuthState> {
  const supabase = requireClient();
  const email = normalizeEmail(emailRaw);
  const code = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code from your email.");

  // Recovery flow: hold the signed-in broadcast until updatePassword
  // runs, so the UI keeps the "set new password" form mounted.
  if (type === "recovery") setRecoveryInProgress(true);

  try {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type });
    if (error) throw error;
    const identity = sessionToIdentity(data.session);
    if (!identity) throw new Error("Verified but session has no user identity.");
    await persistIdentity(identity);
    captureEvent("auth_otp_verified", { type });
    if (type === "recovery") {
      // Don't broadcast; remember the identity so cancelPasswordRecovery
      // or updatePassword can release it.
      setPendingRecoveryIdentity(identity);
    } else {
      await provisionSignedInUser(identity);
      notify({ status: "signed-in", identity });
    }
    return { status: "signed-in", identity };
  } catch (err) {
    if (type === "recovery") {
      // Release the gate so a failed recovery attempt doesn't strand
      // the orchestrator in a held state.
      setRecoveryInProgress(false);
      setPendingRecoveryIdentity(null);
    }
    captureEvent("auth_otp_failed", { type });
    captureError(err, { kind: "auth_otp_verify", type });
    throw toUserError(err, "Couldn't verify that code.");
  }
}

// ---------------------------------------------------------------------------
// Third-party OAuth (chrome.identity.launchWebAuthFlow)
// ---------------------------------------------------------------------------

type OAuthProvider = "google" | "github";

const PROVIDER_LABEL: Record<OAuthProvider, string> = {
  google: "Google",
  github: "GitHub",
};

/**
 * Sign in with a third-party OAuth provider via Supabase, mediated by
 * `chrome.identity.launchWebAuthFlow`. Must be called from a UI surface
 * (sidepanel or settings) — the service worker cannot launch the popup.
 */
async function signInWithSupabaseOAuth(
  provider: OAuthProvider,
  onFinalize?: () => void,
): Promise<AuthState> {
  const supabase = requireClient();
  if (!chrome.identity?.launchWebAuthFlow) {
    throw new Error("Sign-in isn't available from this page — open Settings in the full tab view.");
  }

  const label = PROVIDER_LABEL[provider];
  const redirectUrl = chrome.identity.getRedirectURL();
  captureEvent("auth_signin_started", { provider });

  let oauthResponse;
  try {
    oauthResponse = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });
  } catch (err) {
    captureEvent("auth_signin_failed", { provider });
    captureError(err, { kind: "auth_oauth_request", provider });
    throw toUserError(err, `Couldn't start ${label} sign-in.`);
  }
  const { data, error } = oauthResponse;
  if (error || !data.url) {
    captureEvent("auth_signin_failed", { provider });
    captureError(error ?? new Error("No auth URL"), { kind: "auth_oauth_empty_url", provider });
    throw new Error(
      "The sign-in service didn't return an authorization URL. The cloud service may be temporarily down.",
    );
  }

  const responseUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true }, (result) => {
      const lastErr = chrome.runtime.lastError;
      if (lastErr) {
        const raw = lastErr.message ?? "launchWebAuthFlow failed";
        // Don't log the raw OAuth URL — it contains the state parameter
        // and other query fragments that may leak in browser logs
        // (closes P3.2 / P3.4). The redirect URL is safe (deterministic).
        console.error("[auth] launchWebAuthFlow failed", { raw, redirectUrl, provider });
        captureError(new Error(`launchWebAuthFlow: ${raw}`), {
          kind: "auth_launch_web_auth_flow",
          rawMessage: raw,
          provider,
        });
        const friendly = /authorization page could not be loaded/i.test(raw)
          ? "Couldn't load the sign-in page — the cloud service is unreachable right now. Your local data is safe; try again in a minute."
          : /canceled|cancelled|user did not approve/i.test(raw)
            ? "Sign-in was cancelled."
            : raw;
        reject(new Error(friendly));
        return;
      }
      if (!result) {
        reject(new Error("Sign-in window closed without completing."));
        return;
      }
      resolve(result);
    });
  });

  // The popup has closed; what's left (code exchange + provisioning) runs on
  // this surface and can take a few seconds — let the UI say "finishing up"
  // so it doesn't read as a freeze.
  onFinalize?.();

  const parsedResponse = new URL(responseUrl);
  const code = parsedResponse.searchParams.get("code");
  const oauthError =
    parsedResponse.searchParams.get("error_description") ??
    parsedResponse.searchParams.get("error");

  if (oauthError) {
    captureEvent("auth_signin_failed", { provider });
    throw new Error(oauthError);
  }

  let session: Session | null = null;

  if (!code) {
    // PKCE-only: if Supabase didn't round-trip a `code`, something in
    // the OAuth config is wrong. Refuse to accept tokens from the URL
    // fragment — that's an implicit-flow path and bypasses PKCE's
    // whole threat model (closes P1.5 / P2.4).
    captureEvent("auth_signin_failed", { provider });
    throw new Error(
      "OAuth response missing authorization code — check Supabase URL configuration (PKCE required, implicit flow not accepted).",
    );
  }

  const exchange = await supabase.auth.exchangeCodeForSession(code);
  if (exchange.error) {
    captureEvent("auth_signin_failed", { provider });
    throw exchange.error;
  }
  session = exchange.data?.session ?? null;

  const identity = sessionToIdentity(session);
  if (!identity) throw new Error("Signed in but session has no user identity");

  await persistIdentity(identity);
  await provisionSignedInUser(identity);
  captureEvent("auth_signin_completed", { provider });
  notify({ status: "signed-in", identity });
  return { status: "signed-in", identity };
}

export function signInWithGoogle(onFinalize?: () => void): Promise<AuthState> {
  return signInWithSupabaseOAuth("google", onFinalize);
}

export function signInWithGitHub(onFinalize?: () => void): Promise<AuthState> {
  return signInWithSupabaseOAuth("github", onFinalize);
}

// ---------------------------------------------------------------------------
// `signOut` lives in `./wipe.ts` alongside the other data-wipe routines.
// ---------------------------------------------------------------------------
