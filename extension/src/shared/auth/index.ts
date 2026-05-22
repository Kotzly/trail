/**
 * Auth orchestrator — public surface.
 *
 * Re-exports everything every UI surface and background service needs.
 * The implementation lives in `./orchestrator/`, split by concern:
 *
 *   - `session.ts`       — singleton state, broadcast, identity helpers
 *   - `provisioning.ts`  — first-time user / device row provisioning
 *   - `wipe.ts`          — per-user wipe + signOut cleanup
 *   - `recovery.ts`      — password-reset flow + recovery gate
 *   - `errors.ts`        — error normalization + validators
 *   - `flows.ts`         — initAuth, sign-in/sign-up/OTP/OAuth entry points
 *
 * The hardcoded "which keys survive a user-switch wipe" allow-list is
 * gone — see `USER_SCOPED_STORAGE_ITEMS` in `@shared/config/storage-items`.
 * Adding a new user-scoped key registers itself with the wipe.
 */

export { PASSWORD_MIN_LENGTH, validateEmail, validatePassword } from "./orchestrator/errors.js";

export {
  authReady,
  getAuthState,
  subscribeAuthState,
  subscribeAuthTransition,
  type AuthState,
  type EmailOtpType,
  type SignUpResult,
} from "./orchestrator/session.js";

export {
  cancelPasswordRecovery,
  requestPasswordReset,
  updatePassword,
} from "./orchestrator/recovery.js";

export { signOut } from "./orchestrator/wipe.js";

export {
  initAuth,
  requestEmailOtp,
  resendSignupOtp,
  signInWithEmailPassword,
  signInWithGitHub,
  signInWithGoogle,
  signUpWithEmailPassword,
  verifyEmailOtp,
} from "./orchestrator/flows.js";
