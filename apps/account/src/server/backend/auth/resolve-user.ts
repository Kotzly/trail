import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { verifyUserToken } from "@/src/server/backend/auth/user-auth";
import { ensureUser, getUserById } from "@/src/server/backend/user";

/**
 * Resolve a user ID from a bearer token.
 * Accepts both extension tokens (HMAC-signed JWT) and
 * user tokens (Better Auth JWKS).
 */
export async function resolveUserId(
  token: string | null,
): Promise<string | null> {
  if (!token) return null;

  // 1. Try extension token (HMAC-signed JWT)
  const extension = await verifyExtensionToken(token);
  if (extension?.sub) {
    const user = await getUserById(extension.sub);
    return user?.id ?? null;
  }

  // 2. Fall back to user token (Better Auth JWKS)
  const authUser = await verifyUserToken(token);
  if (!authUser) return null;

  const user = await ensureUser(authUser);
  return user?.id ?? null;
}
