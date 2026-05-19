/**
 * Feature flags for the share-link surface. Two flags so we can flip
 * create vs. import independently:
 *
 *  - `share_create_enabled` — gates the "Share" entry in the trail
 *    action menu and the manage-shares list in Settings. Off by
 *    default; flip per-cohort post-CWS-stable.
 *  - `share_import_enabled` — gates the marketing import button on
 *    `/s/<code>`. Lives in the marketing build (Vercel env var); not
 *    read from here. Listed for documentation.
 *
 * Currently a compile-time constant. When PostHog is wired into the
 * sharing surface, this resolves at runtime from the flag snapshot —
 * mirror the pattern in `extension/src/features/graph/motion/flags.ts`.
 */
export const SHARE_FLAG_KEYS = {
  CREATE_ENABLED: "share_create_enabled",
  IMPORT_ENABLED: "share_import_enabled", // marketing-side only
} as const;

/**
 * Resolve whether the Share UI is enabled for the current user.
 *
 * v1: returns `true` unconditionally inside the extension. The
 * marketing-side `share_import_enabled` env var is what actually
 * controls user exposure during the staged rollout — flipping that
 * off hides the import button on /s/<code>, so the extension's
 * Share dialog is only useful once links can be opened.
 *
 * Wire to PostHog flags once observability is in place.
 */
export function isShareCreateEnabled(): boolean {
  return true;
}
