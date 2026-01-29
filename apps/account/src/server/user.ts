import type { AppUser } from "@trail/trpc";
import { getDevUser, isAuthBypassed } from "@/src/lib/auth0";
import { internalApiJson } from "@/src/server/internal-api";

type Auth0User = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

export async function ensureUser(authUser: Auth0User): Promise<AppUser | null> {
  if (isAuthBypassed()) {
    return getDevUser();
  }

  if (!authUser.sub) {
    return null;
  }

  const { user } = await internalApiJson<{ user: AppUser | null }>(
    "/api/internal/users/ensure",
    {
      method: "POST",
      body: { user: authUser }
    }
  );

  return user;
}
