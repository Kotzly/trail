import { db } from "@trail/db";
import type { AppUser } from "@trail/trpc";

type Auth0User = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

export async function ensureUser(authUser: Auth0User): Promise<AppUser | null> {
  if (!authUser.sub) {
    return null;
  }

  const record = await db.user.upsert({
    where: { auth0Id: authUser.sub },
    update: {
      email: authUser.email ?? null,
      name: authUser.name ?? null,
      imageUrl: authUser.picture ?? null
    },
    create: {
      auth0Id: authUser.sub,
      email: authUser.email ?? null,
      name: authUser.name ?? null,
      imageUrl: authUser.picture ?? null
    }
  });

  return {
    id: record.id,
    email: record.email,
    name: record.name,
    imageUrl: record.imageUrl
  };
}
