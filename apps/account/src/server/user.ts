import type { User } from "@trail/trpc";
import { db } from "@trail/db";
import { devUser, getAuthBypassState } from "@/src/lib/auth";

export async function ensureUser(user: User): Promise<User | undefined> {
  if (getAuthBypassState()) {
    return devUser;
  }

  if (!user.id || !user.email || !user.name) {
    return undefined;
  }

  const record = await db.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.imageUrl ?? null,
      imageUrl: user.imageUrl ?? null,
      emailVerified: true,
    },
    update: {
      email: user.email,
      name: user.name,
      image: user.imageUrl ?? null,
      imageUrl: user.imageUrl ?? null,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      imageUrl: true,
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    imageUrl: (record.image ?? record.imageUrl) ?? undefined,
  };
}
