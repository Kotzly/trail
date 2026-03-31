import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { getUserById } from "@/src/server/backend/user";

/**
 * Resolve a user ID from a bearer token.
 * Accepts extension tokens (HMAC-signed JWT).
 * Cookie-based Supabase sessions are handled separately via getAuthSession().
 */
export async function resolveUserId(
  token: string | null,
): Promise<string | null> {
  if (!token) return null;

  const extension = await verifyExtensionToken(token);
  if (extension?.sub) {
    const user = await getUserById(extension.sub);
    return user?.id ?? null;
  }

  return null;
}
