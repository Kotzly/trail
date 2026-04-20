/**
 * Supabase client factory — single instance per extension surface.
 *
 * Session is persisted via `chrome.storage.local` (not localStorage) so the
 * background service worker, sidepanel, and settings page all share the
 * same session. The `browser.storage.onChanged` subscription in the
 * orchestrator keeps each surface's client in sync on sign-in/out.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { storage } from "wxt/utils/storage";

const sbKey = (key: string) => `local:sb_${key}` as const;

/** Adapter conforming to supabase-js `SupportedStorage` interface. */
const chromeStorageAdapter = {
  getItem: (key: string) => storage.getItem<string>(sbKey(key)),
  setItem: (key: string, value: string) => storage.setItem(sbKey(key), value),
  removeItem: (key: string) => storage.removeItem(sbKey(key)),
};

let cached: SupabaseClient | null = null;

/**
 * Get the shared Supabase client. Returns `null` if env vars are absent
 * (e.g. local dev build without creds) — callers MUST handle this.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cached) return cached;

  const url = import.meta.env.WXT_SUPABASE_URL;
  const anon = import.meta.env.WXT_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  cached = createClient(url, anon, {
    auth: {
      storage: chromeStorageAdapter,
      persistSession: true,
      // supabase-js's auto-refresh uses setInterval, which doesn't
      // survive MV3 service-worker eviction. We drive refresh ourselves
      // via chrome.alarms in the background SW (see trail-auth-refresh).
      autoRefreshToken: false,
      // Extension URL changes per install — detection disabled so we
      // don't try to parse a redirect from the address bar.
      detectSessionInUrl: false,
      flowType: "pkce",
    },
    global: {
      headers: {
        "x-trail-client": "extension",
      },
    },
  });

  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.WXT_SUPABASE_URL && import.meta.env.WXT_SUPABASE_ANON_KEY);
}
