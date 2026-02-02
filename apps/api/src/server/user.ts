import { db } from "@trail/db";
import type { AppUser } from "@trail/trpc";

type AuthUser = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  image?: string;
};

type UserSummary = {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  createdAt: Date;
};

function resolveImageUrl(image?: string | null, imageUrl?: string | null) {
  return image ?? imageUrl ?? null;
}

export async function ensureUser(authUser: AuthUser): Promise<AppUser | null> {
  if (!authUser.sub) {
    return null;
  }

  const record = await db.user.findUnique({
    where: { id: authUser.sub },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      imageUrl: true
    }
  });

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    email: record.email,
    name: record.name,
    imageUrl: resolveImageUrl(record.image, record.imageUrl)
  };
}

export async function getUserById(userId: string): Promise<UserSummary | null> {
  const record = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      imageUrl: true,
      createdAt: true
    }
  });

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    email: record.email,
    name: record.name,
    imageUrl: resolveImageUrl(record.image, record.imageUrl),
    createdAt: record.createdAt
  };
}

export type { AuthUser };
