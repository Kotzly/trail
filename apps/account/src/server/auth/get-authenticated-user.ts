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

export async function getAuthenticatedUser(
  token: string | null | undefined,
): Promise<AuthenticatedUser | null> {
  if (!token) return null;

  const extension = await verifyExtensionToken(token);
  if (!extension?.sub) return null;

  return getUserById(extension.sub, dbAsClient);
}

export async function getAuthenticatedUserId(
  token: string | null | undefined,
): Promise<string | null> {
  const user = await getAuthenticatedUser(token);
  return user?.id ?? null;
}
