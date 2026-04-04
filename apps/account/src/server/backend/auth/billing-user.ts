import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { getUserById } from "@/src/server/backend/user";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { db } from "@trail/db";

const INTERNAL_PREFIX = "internal:";

export async function getUserFromBillingBearerToken(
  token: string | null,
): Promise<Awaited<ReturnType<typeof getUserById>> | null> {
  if (!token) return null;

  // Internal in-process call from billing proxy routes (Supabase session already verified)
  if (token.startsWith(INTERNAL_PREFIX)) {
    const userId = token.slice(INTERNAL_PREFIX.length);
    return userId ? getUserById(userId, db) : null;
  }

  const extension = await verifyExtensionToken(token);
  if (extension?.sub) {
    return getUserById(extension.sub, db);
  }

  return null;
}

export async function getUserFromBillingSession(): Promise<Awaited<ReturnType<typeof getUserById>> | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getUserById(user.id, supabase);
}
