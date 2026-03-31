import { db } from "@trail/db";
import type { AppContext, AppSession } from "@trail/trpc";
import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { ensureUser } from "@/src/server/backend/user";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

async function getRequestSession(headers: Headers): Promise<AppSession> {
  // 1. Try extension bearer token first (API calls from extension)
  const bearer = getBearerToken(headers);
  if (bearer) {
    const ext = await verifyExtensionToken(bearer);
    if (ext?.sub) {
      const user = await ensureUser({ sub: ext.sub });
      return user ? { user } : null;
    }
  }

  // 2. Fall back to Supabase cookie-based session (web UI)
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();
  if (supabaseUser) {
    const appUser = await ensureUser({
      sub: supabaseUser.id,
      email: supabaseUser.email ?? undefined,
      name:
        supabaseUser.user_metadata?.full_name ??
        supabaseUser.user_metadata?.name,
    });
    return appUser ? { user: appUser } : null;
  }

  return null;
}

export async function createTRPCContext(req?: Request): Promise<AppContext> {
  const headers = req?.headers ?? new Headers();
  const session = await getRequestSession(headers);

  return {
    db,
    session,
    headers,
  };
}
