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
  onboardingSeenAt: Date | null;
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
      imageUrl: true,
    },
  });

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    email: record.email,
    name: record.name,
    imageUrl: resolveImageUrl(record.image, record.imageUrl),
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
      createdAt: true,
      onboardingSeenAt: true,
    },
  });

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    email: record.email,
    name: record.name,
    imageUrl: resolveImageUrl(record.image, record.imageUrl),
    createdAt: record.createdAt,
    onboardingSeenAt: record.onboardingSeenAt,
  };
}

export async function getUserOnboardingSeen(
  userId: string,
): Promise<boolean | null> {
  const rows = await db.$queryRaw<Array<{ seenAt: Date | null }>>`
    SELECT "onboardingSeenAt" as "seenAt"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;

  const record = rows[0];
  if (!record) {
    return null;
  }

  return record.seenAt !== null;
}

export async function markUserOnboardingSeen(
  userId: string,
): Promise<Date | null> {
  const updatedRows = await db.$executeRaw`
    UPDATE "User"
    SET "onboardingSeenAt" = COALESCE("onboardingSeenAt", NOW()),
        "updatedAt" = NOW()
    WHERE "id" = ${userId}
  `;

  if (updatedRows === 0) {
    return null;
  }

  const record = await db.user.findUnique({
    where: { id: userId },
    select: { onboardingSeenAt: true },
  });

  return record?.onboardingSeenAt ?? null;
}

export async function resetUserOnboarding(
  userId: string,
): Promise<boolean> {
  const updatedRows = await db.$executeRaw`
    UPDATE "User"
    SET "onboardingSeenAt" = NULL,
        "updatedAt" = NOW()
    WHERE "id" = ${userId}
  `;

  return updatedRows > 0;
}

export type { AuthUser };
