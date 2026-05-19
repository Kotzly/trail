"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client for the marketing app.
 *
 * Used by `/auth/reset-password` to exchange the recovery code in the
 * email link for a session and then call `updateUser({ password })`.
 *
 * PKCE flow matches the extension's flowType so emailed links land
 * consistently. `persistSession` is left at the default (true) so the
 * code-for-session exchange survives the form submit; we don't bother
 * signing out afterwards — closing the tab is enough.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    },
  );
}
