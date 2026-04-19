/**
 * Auth orchestrator — runs in every surface, wraps supabase-js.
 *
 * Three sign-in flows are supported:
 *
 * 1. Google OAuth (third-party). MV3 extension uses
 *    `supabase.auth.signInWithOAuth({ provider: 'google', options: {
 *      redirectTo: chrome.identity.getRedirectURL(), skipBrowserRedirect: true
 *    }})` to obtain an auth URL. We feed it to
 *    `chrome.identity.launchWebAuthFlow`, parse tokens from the redirect
 *    fragment, and call `supabase.auth.setSession`.
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
 *    cannot be used to silently provision unverified accounts (account
 *    enumeration mitigation: callers see "code sent" regardless, but
 *    only legitimate users actually receive one). Verify with
 *    `verifyEmailOtp(email, token, "email")`.
 *
 * Magic links are NOT used: an extension cannot reliably catch the
 * link-click in a normal browser tab (Chrome opens it outside the
 * extension's storage origin). 6-digit codes work everywhere.
 *
 * Supabase persists the session via `chrome.storage.local` so the
 * background service worker, sidepanel, and settings page share state
 * (see `src/shared/lib/supabase.ts`). The
 * `supabase.auth.onAuthStateChange` listener keeps the cached identity
 * current.
 *
 * OAuth provider client_id + secret are configured INSIDE Supabase
 * Dashboard, not in this code.
 */

import type { AuthError, Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@shared/lib/supabase.js";
import { authIdentityItem, deviceIdItem, type AuthIdentity } from "@shared/config/storage-items.js";
import { captureError, captureEvent, resetTelemetryIdentity } from "@shared/lib/observability.js";
import { createLogger } from "@shared/lib/logger.js";

const log = createLogger("auth");

export type AuthState =
  | { status: "unconfigured" }
  | { status: "signed-out" }
  | { status: "signed-in"; identity: AuthIdentity };

export type EmailOtpType = "email" | "signup" | "recovery";

export type SignUpResult =
  | { status: "signed-in"; identity: AuthIdentity }
  | { status: "awaiting-confirmation"; email: string };

export const PASSWORD_MIN_LENGTH = 8;

let cachedState: AuthState | null = null;
const listeners = new Set<(state: AuthState) => void>();

/**
 * While true, the orchestrator suppresses `signed-in` broadcasts even
 * though Supabase has issued a temporary recovery session. This keeps
 * the sign-in UI mounted long enough for the user to choose a new
 * password — without it, listeners flip to `signed-in` the instant the
 * recovery OTP is verified and the "set new password" form unmounts.
 */
let recoveryInProgress = false;
let pendingRecoveryIdentity: AuthIdentity | null = null;

async function ensureDeviceId(): Promise<string> {
  const existing = await deviceIdItem.getValue();
  if (existing) return existing;
  const next = crypto.randomUUID();
  await deviceIdItem.setValue(next);
  return next;
}

function detectOs(ua: string): string | null {
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad/.test(ua)) return "iOS";
  return null;
}

/**
 * Upsert the current device into `public.devices`. Required before any
 * `trails` write because `trails.device_id` has a FK to `devices.id`.
 * Idempotent — safe to call on every signed-in transition.
 */
async function ensureDeviceRegistered(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const deviceId = await ensureDeviceId();
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const chromeVersion = ua.match(/Chrome\/(\S+)/)?.[1] ?? null;
    const manifestVersion =
      typeof chrome !== "undefined" && chrome.runtime?.getManifest
        ? chrome.runtime.getManifest().version
        : null;
    const { error } = await supabase.from("devices").upsert(
      {
        id: deviceId,
        user_id: userId,
        os: detectOs(ua),
        locale: typeof navigator !== "undefined" ? navigator.language : null,
        timezone:
          typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : null,
        browser_name: "Chrome",
        browser_version: chromeVersion,
        extension_version: manifestVersion,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) throw error;
  } catch (err) {
    captureError(err, { kind: "auth_device_register" });
  }
}

function sessionToIdentity(session: Session | null): AuthIdentity | null {
  if (!session?.user) return null;
  const meta = session.user.user_metadata ?? {};
  const rawProvider =
    (typeof session.user.app_metadata?.provider === "string" &&
      session.user.app_metadata.provider) ||
    session.user.identities?.[0]?.provider ||
    null;
  const provider: AuthIdentity["provider"] =
    rawProvider === "google" ? "google" : rawProvider === "email" ? "email" : "other";
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

function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Cloud sync isn't configured in this build of Trail. Your trees stay local-only.",
    );
  }
  return supabase;
}

function isAuthError(err: unknown): err is AuthError {
  return Boolean(err && typeof err === "object" && "name" in err && "status" in err);
}

/**
 * True network failures surface as `TypeError("Failed to fetch")` in
 * Chromium and `TypeError("Load failed")` in Safari. Everything else —
 * including Supabase errors whose `message` merely mentions "fetch" as
 * part of a longer sentence — should flow through with its real text
 * so users see what actually broke.
 */
function isRealNetworkFailure(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const probe = (candidate: unknown): boolean => {
    if (!(candidate instanceof Error)) return false;
    if (!(candidate instanceof TypeError)) return false;
    return /^(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$/.test(
      candidate.message,
    );
  };
  if (probe(err)) return true;
  if (err instanceof Error && probe(err.cause)) return true;
  return false;
}

/**
 * Translate a Supabase AuthError or generic error into a user-actionable
 * sentence. Keeps the underlying error attached as `cause` so Sentry
 * still gets the raw context. Avoids leaking server-side details that
 * would aid account enumeration or credential stuffing.
 *
 * Non-matched AuthErrors pass their original message through — the old
 * behaviour replaced them with a generic "cloud service unavailable"
 * blurb whenever the message happened to contain the word "fetch",
 * which swallowed real reasons the user needed to see.
 */
function toUserError(err: unknown, fallback: string): Error {
  if (isRealNetworkFailure(err)) {
    return new Error(
      "Couldn't reach the sign-in service. Check your connection and try again — your local trees are not affected.",
      { cause: err instanceof Error ? err : undefined },
    );
  }
  if (isAuthError(err)) {
    const code = err.code;
    const msg = err.message;
    let friendly = fallback;
    if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) {
      friendly =
        "That email or password doesn't match. If you signed up with Google, use the Google button. If you forgot your password, request a reset code.";
    } else if (code === "email_not_confirmed" || /email not confirmed/i.test(msg)) {
      friendly = "Confirm your email first — check your inbox for the 6-digit code we sent.";
    } else if (code === "user_already_exists" || /user already registered/i.test(msg)) {
      friendly =
        "An account with that email already exists. Try signing in, or request a code if you forgot the password.";
    } else if (code === "weak_password" || /password.*(short|weak)/i.test(msg)) {
      friendly = `Password is too weak. Use at least ${PASSWORD_MIN_LENGTH} characters with a mix of letters and numbers.`;
    } else if (code === "otp_expired" || /token.*(expired|invalid)/i.test(msg)) {
      friendly = "That code is invalid or has expired. Request a new one and try again.";
    } else if (code === "over_email_send_rate_limit" || /rate limit/i.test(msg)) {
      friendly = "Too many requests. Please wait a minute and try again.";
    } else if (msg) {
      friendly = msg;
    }
    return new Error(friendly, { cause: err });
  }
  if (err instanceof Error) {
    return new Error(err.message || fallback, { cause: err });
  }
  return new Error(fallback);
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
      void ensureDeviceRegistered(identity.userId);
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
      if (recoveryInProgress) {
        // Hold the broadcast until the password change completes — see
        // the `recoveryInProgress` doc-comment above.
        pendingRecoveryIdentity = identity;
        return;
      }
      await authIdentityItem.setValue(identity);
      void ensureDeviceRegistered(identity.userId);
      notify({ status: "signed-in", identity });
    } else {
      await authIdentityItem.setValue(null);
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
          const current = cachedState;
          const sameStatus =
            (current?.status === "signed-in" && nextIdentity) ||
            (current?.status === "signed-out" && !nextIdentity);
          if (sameStatus) return;
          if (nextIdentity) {
            if (recoveryInProgress) {
              pendingRecoveryIdentity = nextIdentity;
              return;
            }
            await authIdentityItem.setValue(nextIdentity);
            void ensureDeviceRegistered(nextIdentity.userId);
            notify({ status: "signed-in", identity: nextIdentity });
          } else {
            await authIdentityItem.setValue(null);
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

// ---------------------------------------------------------------------------
// Validation helpers (also surfaced to the UI)
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required.";
  if (trimmed.length > 254) return "Email is too long.";
  if (!EMAIL_RE.test(trimmed)) return "Enter a valid email address.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > 72) {
    // bcrypt's hard limit; Supabase truncates silently otherwise.
    return "Password must be 72 characters or fewer.";
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain both letters and numbers.";
  }
  return null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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
    await authIdentityItem.setValue(identity);
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
      await authIdentityItem.setValue(identity);
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
  if (type === "recovery") recoveryInProgress = true;

  try {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type });
    if (error) throw error;
    const identity = sessionToIdentity(data.session);
    if (!identity) throw new Error("Verified but session has no user identity.");
    await authIdentityItem.setValue(identity);
    captureEvent("auth_otp_verified", { type });
    if (type === "recovery") {
      // Don't broadcast; remember the identity so cancelPasswordRecovery
      // or updatePassword can release it.
      pendingRecoveryIdentity = identity;
    } else {
      notify({ status: "signed-in", identity });
    }
    return { status: "signed-in", identity };
  } catch (err) {
    if (type === "recovery") {
      // Release the gate so a failed recovery attempt doesn't strand
      // the orchestrator in a held state.
      recoveryInProgress = false;
      pendingRecoveryIdentity = null;
    }
    captureEvent("auth_otp_failed", { type });
    captureError(err, { kind: "auth_otp_verify", type });
    throw toUserError(err, "Couldn't verify that code.");
  }
}

// ---------------------------------------------------------------------------
// Password reset (uses OTP, not magic-link, for extension compatibility)
// ---------------------------------------------------------------------------

/**
 * Send a recovery code. The user types it into our OTP input and is
 * temporarily signed in via `verifyEmailOtp(email, token, "recovery")`,
 * after which they MUST call `updatePassword` to complete the reset.
 */
export async function requestPasswordReset(emailRaw: string): Promise<{ email: string }> {
  const supabase = requireClient();
  const email = normalizeEmail(emailRaw);
  const emailErr = validateEmail(email);
  if (emailErr) throw new Error(emailErr);

  captureEvent("auth_password_reset_requested");
  try {
    const redirectTo = chrome.identity?.getRedirectURL?.();
    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (error) {
      const code = isAuthError(error) ? error.code : undefined;
      const msg = error.message ?? "";
      const isEnumerationLeak = code === "user_not_found" || /user not found/i.test(msg);
      if (!isEnumerationLeak) throw error;
      captureError(error, { kind: "auth_reset_enumeration_swallowed" });
    }
    // Arm the recovery gate — the next `verifyEmailOtp(..., "recovery")`
    // will hold the signed-in broadcast until `updatePassword` runs.
    recoveryInProgress = true;
    return { email };
  } catch (err) {
    captureError(err, { kind: "auth_password_reset" });
    throw toUserError(err, "Couldn't send the reset code. Try again in a moment.");
  }
}

/**
 * Cancel an in-progress recovery (e.g. user closes the panel before
 * setting a new password). Releases the broadcast gate without rotating
 * the password.
 */
export function cancelPasswordRecovery(): void {
  if (!recoveryInProgress) return;
  recoveryInProgress = false;
  if (pendingRecoveryIdentity) {
    const identity = pendingRecoveryIdentity;
    pendingRecoveryIdentity = null;
    void authIdentityItem.setValue(identity);
    notify({ status: "signed-in", identity });
  }
}

/**
 * Set a new password for the currently signed-in user. Used after
 * `verifyEmailOtp(..., "recovery")` to complete a password reset, or
 * standalone from settings.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = requireClient();
  const passwordErr = validatePassword(newPassword);
  if (passwordErr) throw new Error(passwordErr);

  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    captureEvent("auth_password_changed");
    // Recovery completed — release the gate and broadcast signed-in.
    if (recoveryInProgress) {
      recoveryInProgress = false;
      const identity = pendingRecoveryIdentity;
      pendingRecoveryIdentity = null;
      if (identity) {
        await authIdentityItem.setValue(identity);
        notify({ status: "signed-in", identity });
      }
    }
  } catch (err) {
    captureError(err, { kind: "auth_update_password" });
    throw toUserError(err, "Couldn't update your password.");
  }
}

// ---------------------------------------------------------------------------
// Google OAuth (chrome.identity.launchWebAuthFlow)
// ---------------------------------------------------------------------------

/**
 * Sign in with Google via Supabase OAuth, mediated by
 * `chrome.identity.launchWebAuthFlow`. Must be called from a UI surface
 * (sidepanel or settings) — the service worker cannot launch the popup.
 */
export async function signInWithGoogle(): Promise<AuthState> {
  const supabase = requireClient();
  if (!chrome.identity?.launchWebAuthFlow) {
    throw new Error("Sign-in isn't available from this page — open Settings in the full tab view.");
  }

  const redirectUrl = chrome.identity.getRedirectURL();
  captureEvent("auth_signin_started", { provider: "google" });

  let oauthResponse;
  try {
    oauthResponse = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });
  } catch (err) {
    captureEvent("auth_signin_failed", { provider: "google" });
    captureError(err, { kind: "auth_oauth_request" });
    throw toUserError(err, "Couldn't start Google sign-in.");
  }
  const { data, error } = oauthResponse;
  if (error || !data.url) {
    captureEvent("auth_signin_failed", { provider: "google" });
    captureError(error ?? new Error("No auth URL"), { kind: "auth_oauth_empty_url" });
    throw new Error(
      "The sign-in service didn't return an authorization URL. The cloud service may be temporarily down.",
    );
  }

  const responseUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true }, (result) => {
      const lastErr = chrome.runtime.lastError;
      if (lastErr) {
        const raw = lastErr.message ?? "launchWebAuthFlow failed";
        console.error("[auth] launchWebAuthFlow failed", { raw, oauthUrl: data.url, redirectUrl });
        captureError(new Error(`launchWebAuthFlow: ${raw}`), {
          kind: "auth_launch_web_auth_flow",
          rawMessage: raw,
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

  const parsedResponse = new URL(responseUrl);
  const code = parsedResponse.searchParams.get("code");
  const oauthError =
    parsedResponse.searchParams.get("error_description") ??
    parsedResponse.searchParams.get("error");

  if (oauthError) {
    captureEvent("auth_signin_failed", { provider: "google" });
    throw new Error(oauthError);
  }

  let session: Session | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      captureEvent("auth_signin_failed", { provider: "google" });
      throw error;
    }
    session = data?.session ?? null;
  } else {
    const hashParams = new URLSearchParams(parsedResponse.hash.replace(/^#/, ""));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (!accessToken || !refreshToken) {
      captureEvent("auth_signin_failed", { provider: "google" });
      throw new Error("No tokens in auth response — check Supabase URL configuration");
    }
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      captureEvent("auth_signin_failed", { provider: "google" });
      throw error;
    }
    session = data.session;
  }

  const identity = sessionToIdentity(session);
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
