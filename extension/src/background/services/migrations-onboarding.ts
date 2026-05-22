/**
 * Pure helper for the v3→v4 `drop_onboarding_orphans` migration.
 *
 * Six fields were removed from `OnboardingState` when the interactive
 * onboarding tour was retired (commit 7e118e8e): `tourStep`,
 * `tourTreeId`, `tourFirstResultChildId`, `tourBranchParentId`,
 * `priorActiveTreeId`, and `softCtaDismissed`. The runtime save path
 * (`saveOnboardingState`) is merge-style, so any user who installed
 * before that commit still carries the orphan keys forward on every
 * write. This helper drops them.
 *
 * Implementation uses a whitelist (rather than a blacklist) so future
 * field churn is self-healing — if more fields get removed, they'll
 * fall out automatically the next time the migration runs.
 *
 * Extracted into its own module so the transform can be unit-tested
 * without dragging in `wxt/utils/storage` (which is unavailable in the
 * `node --import tsx` test harness, as called out in
 * `migrations.test.ts`). The allowed-keys list is inlined here rather
 * than imported from `storage-items.ts` for the same reason. The
 * `_coverageCheck` type assertion below catches drift at compile-time:
 * if a key is added to `OnboardingState` and not to `ALLOWED_KEYS`,
 * `tsc` fails.
 *
 * No side effects, no I/O.
 */

import type { OnboardingState } from "../../shared/config/storage-items.js";

/**
 * The keys that survive the migration. Must match the current shape of
 * `OnboardingState` exactly. The exhaustiveness check below makes drift
 * a compile-time error.
 */
const ALLOWED_KEYS = [
  "seenWelcome",
  "completedAt",
  "step",
  "phase",
  "wizardStep",
  "persona",
  "startedAt",
] as const;

type AllowedKey = (typeof ALLOWED_KEYS)[number];

// Compile-time exhaustiveness: if a new required key is added to
// OnboardingState without being listed in ALLOWED_KEYS, the second
// branch (`keyof OnboardingState extends AllowedKey`) collapses to
// `never` and the assignment fails. Conversely, if a key is removed
// from OnboardingState but left in ALLOWED_KEYS, the first branch
// (`AllowedKey extends keyof OnboardingState`) fails.
type _StateHasAllAllowedKeys = AllowedKey extends keyof OnboardingState ? true : never;
type _AllowedHasAllStateKeys = keyof OnboardingState extends AllowedKey ? true : never;
const _coverageCheck: [_StateHasAllAllowedKeys, _AllowedHasAllStateKeys] = [true, true];

/**
 * Strip any keys not present in the current `OnboardingState` shape.
 * Returns a fresh object — never mutates the input.
 *
 * Behavior:
 *   - Non-object input (null, undefined, corrupted entry) returns a
 *     fresh canonical-default object so the next read is well-formed.
 *   - Object input returns a shallow copy keeping only keys listed in
 *     `ALLOWED_KEYS`. Values pass through untouched — validation is
 *     the caller's job; we only do shape pruning here.
 *   - A clean object (already current-shape) returns a clone that is
 *     `deepEqual` to the input. Idempotent.
 */
export function cleanOnboardingState(raw: unknown): OnboardingState {
  if (!raw || typeof raw !== "object") {
    return freshInitial();
  }
  const source = raw as Record<string, unknown>;
  // Start from the canonical default so any missing-but-required keys
  // get a well-formed value rather than `undefined`.
  const next: Record<string, unknown> = freshInitial();
  for (const key of ALLOWED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      next[key] = source[key];
    }
  }
  return next as OnboardingState;
}

/**
 * Return `true` iff `raw` carries at least one key that is NOT part of
 * the current `OnboardingState` shape. Used by the migration to skip
 * the write when storage is already clean.
 */
export function hasOnboardingOrphans(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const allowed = new Set<string>(ALLOWED_KEYS);
  for (const key of Object.keys(raw as Record<string, unknown>)) {
    if (!allowed.has(key)) return true;
  }
  return false;
}

/**
 * Canonical default. Mirrors `INITIAL_ONBOARDING_STATE` from
 * `storage-items.ts` (kept in lock-step via the `_coverageCheck` type
 * assertion above). Defined here rather than imported because
 * `storage-items.ts` pulls in `wxt/utils/storage`, which the test
 * harness can't resolve.
 */
function freshInitial(): OnboardingState {
  return {
    seenWelcome: false,
    completedAt: null,
    step: 0,
    phase: null,
    wizardStep: 0,
    persona: null,
    startedAt: null,
  };
}
