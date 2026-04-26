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

// Fontsource packages ship CSS only, no .d.ts. Side-effect imports
// (`import "@fontsource/X"`) work without types, but dynamic imports
// in font-loaders.ts need a module shape — declare any.
declare module "@fontsource/*";
declare module "@fontsource-variable/*";

// tinykeys 3.0.0 ships its types via "types" but doesn't list them in
// "exports", so moduleResolution: bundler can't find them. Re-declare
// the small subset of the API the project consumes.
declare module "tinykeys" {
  export interface KeyBindingMap {
    [keybinding: string]: (event: KeyboardEvent) => void;
  }
  export interface KeyBindingOptions {
    timeout?: number;
    event?: "keydown" | "keyup";
    capture?: boolean;
  }
  export function tinykeys(
    target: Window | HTMLElement,
    keyBindingMap: KeyBindingMap,
    options?: KeyBindingOptions,
  ): () => void;
}
