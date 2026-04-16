/**
 * Supabase client factory — single instance per extension surface.
 *
 * Session is persisted via `chrome.storage.local` (not localStorage) so the
 * background service worker, sidepanel, and settings page all share the
 * same session. The `browser.storage.onChanged` subscription in the
 * orchestrator keeps each surface's client in sync on sign-in/out.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { browser } from "@shared/platform/webext.js";

const STORAGE_KEY_PREFIX = "sb_";

/** Adapter conforming to supabase-js `SupportedStorage` interface. */
const chromeStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const full = `${STORAGE_KEY_PREFIX}${key}`;
    const result = await browser.storage.local.get(full);
    const value = result[full];
    return typeof value === "string" ? value : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    const full = `${STORAGE_KEY_PREFIX}${key}`;
    await browser.storage.local.set({ [full]: value });
  },
  async removeItem(key: string): Promise<void> {
    const full = `${STORAGE_KEY_PREFIX}${key}`;
    await browser.storage.local.remove(full);
  },
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
      autoRefreshToken: true,
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
