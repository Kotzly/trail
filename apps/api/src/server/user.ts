import { db } from "@trail/db";
import type { AppUser } from "@trail/trpc";

type Auth0User = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

type UserSummary = {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  createdAt: Date;
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
    },
    select: {
      id: true,
      email: true,
      name: true,
      imageUrl: true
    }
  });

  return {
    id: record.id,
    email: record.email,
    name: record.name,
    imageUrl: record.imageUrl
  };
}

export async function getUserById(userId: string): Promise<UserSummary | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      imageUrl: true,
      createdAt: true
    }
  });
}

export type { Auth0User };
