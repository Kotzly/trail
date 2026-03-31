"use client";

import { createBrowserClient } from "@supabase/ssr";

// TODO: Add Database type generic after supabase gen types (Phase 4)

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
