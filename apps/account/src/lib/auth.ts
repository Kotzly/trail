import "server-only";

import type { UUID } from "crypto";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type User = {
  id: UUID;
  email: string;
  name: string;
  imageUrl?: string;
};

export type AuthSession = {
  user: User;
};

/**
 * Resolve the current cookie-based Supabase session. Used by RSC pages
 * and Server Actions that authenticate via the @supabase/ssr cookie
 * flow. Bearer-token auth (extension) is handled separately via
 * `@/src/server/auth/get-authenticated-user`.
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return {
    user: {
      id: user.id as UUID,
      email: user.email ?? "",
      name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        user.email ??
        "User",
      imageUrl:
        (user.user_metadata?.avatar_url as string | undefined) ??
        (user.user_metadata?.picture as string | undefined) ??
        undefined,
    },
  };
}
