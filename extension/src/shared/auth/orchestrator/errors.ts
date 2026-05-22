/**
 * Auth error normalization.
 *
 * Maps Supabase AuthError instances + raw network failures to user-actionable
 * sentences while keeping the underlying error attached as `cause` so Sentry
 * still gets the raw context. Avoids leaking server-side details that would
 * aid account enumeration or credential stuffing.
 */

import type { AuthError } from "@supabase/supabase-js";

export const PASSWORD_MIN_LENGTH = 8;

export function isAuthError(err: unknown): err is AuthError {
  return Boolean(err && typeof err === "object" && "name" in err && "status" in err);
}

/**
 * True network failures surface as `TypeError("Failed to fetch")` in
 * Chromium and `TypeError("Load failed")` in Safari. Everything else —
 * including Supabase errors whose `message` merely mentions "fetch" as
 * part of a longer sentence — should flow through with its real text
 * so users see what actually broke.
 */
export function isRealNetworkFailure(err: unknown): boolean {
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
 * still gets the raw context.
 *
 * Non-matched AuthErrors pass their original message through — the old
 * behaviour replaced them with a generic "cloud service unavailable"
 * blurb whenever the message happened to contain the word "fetch",
 * which swallowed real reasons the user needed to see.
 */
export function toUserError(err: unknown, fallback: string): Error {
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
      friendly = `Password is too weak. Use at least ${PASSWORD_MIN_LENGTH} characters including lowercase, uppercase, a number, and a symbol.`;
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
  // Mirrors the hosted Supabase policy `lower_upper_letters_digits_symbols`.
  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^a-zA-Z0-9]/.test(password)
  ) {
    return "Password must include lowercase, uppercase, a number, and a symbol.";
  }
  return null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
