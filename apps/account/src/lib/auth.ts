import "server-only";

import type { UUID } from "crypto";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { getUserById } from "@/src/server/backend/user";

export const AUTH_COOKIE_NAME = "trail_auth_session";

export type User = {
  id: UUID;
  email: string;
  name: string;
  imageUrl?: string;
};

export type AuthSession = {
  user: User;
};

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

export async function getUserFromToken(
  token: string,
): Promise<User | undefined> {
  if (!token) {
    return undefined;
  }

  const extension = await verifyExtensionToken(token);
  if (!extension?.sub) {
    return undefined;
  }

  const user = await getUserById(extension.sub);
  if (!user) {
    return undefined;
  }

  return {
    id: user.id as UUID,
    email: user.email ?? "",
    name: user.name ?? user.email ?? "User",
    imageUrl: user.imageUrl ?? undefined,
  };
}
