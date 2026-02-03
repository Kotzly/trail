import type { AppUser } from "@trail/trpc";
import { getDevUser, isAuthBypassed } from "@/src/lib/auth";
import { internalApiJson } from "@/src/server/internal-api";

type AuthUser = {
  id?: string;
  sub?: string;
  email?: string;
  name?: string;
  imageUrl?: string | null;
  picture?: string | null;
};

export async function ensureUser(authUser: AuthUser): Promise<AppUser | null> {
  if (isAuthBypassed()) {
    return getDevUser();
  }

  const authId = authUser.sub ?? authUser.id;
  if (!authId) {
    return null;
  }

  const normalizedUser = {
    sub: authId,
    email: authUser.email,
    name: authUser.name,
    picture: authUser.picture ?? authUser.imageUrl ?? undefined
  };

  const { user } = await internalApiJson<{ user: AppUser | null }>(
    "/api/internal/users/ensure",
    {
      method: "POST",
      body: { user: normalizedUser }
    }
  );

  return user;
}
