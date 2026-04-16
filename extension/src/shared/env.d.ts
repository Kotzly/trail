/// <reference types="vite/client" />

/**
 * WXT env variables (prefixed `WXT_` to be exposed to the extension bundle).
 *
 * Populate these in `.env.local` (gitignored). The `.env.example` file at
 * the package root has documentation for each.
 */
interface ImportMetaEnv {
  readonly WXT_SUPABASE_URL?: string;
  readonly WXT_SUPABASE_ANON_KEY?: string;
  readonly WXT_SENTRY_DSN?: string;
  readonly WXT_POSTHOG_KEY?: string;
  readonly WXT_POSTHOG_HOST?: string;
  readonly WXT_RELEASE_CHANNEL?: "stable" | "beta" | "dev";
  readonly WXT_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
