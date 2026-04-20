/**
 * Single bearer-token → user resolver.
 *
 * Before this file existed, apps/account had THREE parallel resolvers
 * that all did the same thing with subtle differences:
 *   - getUserFromToken        (src/lib/auth.ts)              → User | undefined
 *   - resolveUserId           (backend/auth/resolve-user.ts) → string | null
 *   - getUserFromBillingBearerToken (backend/auth/billing-user.ts) → UserSummary | null
 *
 * Each call site had to remember which of the three variants applied
 * to its use case, and a bug in one never propagated to the other two.
 * This resolver is the only supported entry point going forward
 * (closes Phase-A6 of the full-review plan).
 *
 * Cookie-based Supabase sessions (SSR pages) still go through
 * getAuthSession() in src/lib/auth.ts — that's a separate concern
 * and intentionally not merged here.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { getUserById } from "@/src/server/backend/user";
import { db } from "@trail/db";

// getUserById still takes an untyped SupabaseClient parameter (the
// backend wrappers predate the Database-generic rollout). Cast at the
// boundary so this file stays typed at the db side.
const dbAsClient = db as unknown as SupabaseClient;

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  createdAt: Date;
  onboardingSeenAt: Date | null;
};

type Options = {
  /**
   * Accept the `internal:<uuid>` pseudo-token used by in-process
   * billing proxy routes that have already verified a Supabase cookie
   * session. Default: false — only the billing routes should opt in.
   */
  allowInternal?: boolean;
};

const INTERNAL_PREFIX = "internal:";

export async function getAuthenticatedUser(
  token: string | null | undefined,
  options: Options = {},
): Promise<AuthenticatedUser | null> {
  if (!token) return null;

  if (options.allowInternal && token.startsWith(INTERNAL_PREFIX)) {
    const userId = token.slice(INTERNAL_PREFIX.length);
    if (!userId) return null;
    return getUserById(userId, dbAsClient);
  }

  const extension = await verifyExtensionToken(token);
  if (!extension?.sub) return null;

  return getUserById(extension.sub, dbAsClient);
}

/**
 * Convenience wrapper when the caller only needs the user ID.
 * Avoids a database fetch when the route just wants to scope a query.
 *
 * Today this still calls `verifyExtensionToken` (which itself hits the
 * DB to validate the session row) and then `getUserById` for shape.
 * If the hot-path ever needs to skip the second fetch, we can split
 * this into a token-only path.
 */
export async function getAuthenticatedUserId(
  token: string | null | undefined,
  options: Options = {},
): Promise<string | null> {
  const user = await getAuthenticatedUser(token, options);
  return user?.id ?? null;
}
