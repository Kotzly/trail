import { createServerClient } from "@supabase/ssr";
import type { Database } from "@trail/db/types";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          // Force secure attrs on every cookie we forward. @supabase/ssr
          // usually sets these too, but explicit is better than relying
          // on SDK defaults to drift-proof future upgrades (closes P2.3).
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, {
              ...options,
              httpOnly: options?.httpOnly ?? true,
              secure: options?.secure ?? process.env.NODE_ENV === "production",
              sameSite: options?.sameSite ?? "lax",
              path: options?.path ?? "/",
            });
          }
        },
      },
    },
  );

  // Refresh session — must not be removed or the user may be logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
