/**
 * Password-reset / recovery flow.
 *
 * The recovery gate (`isRecoveryInProgress` in `session.ts`) suppresses
 * `signed-in` broadcasts during the short window between a successful
 * recovery-OTP verify and the user committing to a new password — without
 * it, listeners flip to `signed-in` the instant the recovery OTP is
 * verified and the "set new password" form unmounts.
 */

import { captureError, captureEvent } from "@shared/lib/observability.js";
import {
  isAuthError,
  normalizeEmail,
  toUserError,
  validateEmail,
  validatePassword,
} from "./errors.js";
import {
  getPendingRecoveryIdentity,
  isRecoveryInProgress,
  notify,
  persistIdentity,
  requireClient,
  setPendingRecoveryIdentity,
  setRecoveryInProgress,
} from "./session.js";
import { runUserChangeWipeIfNeeded } from "./wipe.js";

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
    // Land the recovery email link on the public marketing reset-password
    // page. Users with the extension installed can also use the OTP from
    // the email body inside the extension; users on a different device
    // / fresh browser fall through to the web form.
    const redirectTo = "https://gettrail.net/auth/reset-password";
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      const code = isAuthError(error) ? error.code : undefined;
      const msg = error.message ?? "";
      const isEnumerationLeak = code === "user_not_found" || /user not found/i.test(msg);
      if (!isEnumerationLeak) throw error;
      captureError(error, { kind: "auth_reset_enumeration_swallowed" });
    }
    // Arm the recovery gate — the next `verifyEmailOtp(..., "recovery")`
    // will hold the signed-in broadcast until `updatePassword` runs.
    setRecoveryInProgress(true);
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
  if (!isRecoveryInProgress()) return;
  setRecoveryInProgress(false);
  const identity = getPendingRecoveryIdentity();
  if (identity) {
    setPendingRecoveryIdentity(null);
    void persistIdentity(identity);
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
    if (isRecoveryInProgress()) {
      setRecoveryInProgress(false);
      const identity = getPendingRecoveryIdentity();
      setPendingRecoveryIdentity(null);
      if (identity) {
        await persistIdentity(identity);
        // Cross-account recovery: someone signed in to A might run
        // password recovery as B on the same browser. Run the wipe
        // before `notify` so the sync engine doesn't backfill A's
        // local trees under B's auth.uid().
        await runUserChangeWipeIfNeeded(identity);
        notify({ status: "signed-in", identity });
      }
    }
  } catch (err) {
    captureError(err, { kind: "auth_update_password" });
    throw toUserError(err, "Couldn't update your password.");
  }
}
