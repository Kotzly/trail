import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client for the marketing app.
 *
 * Used by the public shared-trail viewer at `/s/<code>` (anon-callable
 * RPC `get_shared_trail`) and other server components that read
 * Supabase. Cookies are wired so a signed-in extension user landing on
 * a marketing page (e.g. via /auth/reset-password) sees their session,
 * but the share viewer itself works fully unauthenticated.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll called from a Server Component — safe to ignore.
          }
        },
      },
    },
  );
}
