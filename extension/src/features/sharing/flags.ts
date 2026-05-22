/**
 * Feature flag keys for the share-link surface. Documentation
 * constants — the flags themselves aren't read from the extension yet:
 *
 *  - `share_create_enabled` — would gate the "Share" entry in the
 *    trail action menu and the manage-shares list in Settings. Not
 *    currently consulted at runtime; staged rollout is driven by the
 *    marketing-side gate below instead.
 *  - `share_import_enabled` — gates the marketing import button on
 *    `/s/<code>`. Lives in the marketing build (Vercel env var); not
 *    read from here. Listed for documentation.
 *
 * When PostHog is wired into the sharing surface, resolve these at
 * runtime from the flag snapshot — mirror the pattern in
 * `extension/src/features/graph/motion/flags.ts`.
 */
export const SHARE_FLAG_KEYS = {
  CREATE_ENABLED: "share_create_enabled",
  IMPORT_ENABLED: "share_import_enabled", // marketing-side only
} as const;
