import {
  DEFAULT_EXTENSION_TOKEN_TTL_SECONDS,
  createSignedExtensionToken,
  type ExtensionTokenPayload,
  verifySignedExtensionToken,
} from "@trail/trpc";
import { db } from "@trail/db";
import { env } from "@/src/env";

const TOKEN_TTL_SECONDS = DEFAULT_EXTENSION_TOKEN_TTL_SECONDS;

export function createExtensionToken(
  userId: string,
  ttlSeconds: number = TOKEN_TTL_SECONDS,
): { token: string; expiresAt: string } {
  return createSignedExtensionToken(
    env.TRAIL_EXTENSION_JWT_SECRET,
    userId,
    ttlSeconds,
  );
}

async function isRevoked(
  userId: string,
  issuedAtSeconds: number,
): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ revokedAt: Date | null }>>`
    SELECT "extensionAuthRevokedAt" as "revokedAt"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;
  const revokedAt = rows[0]?.revokedAt ?? null;
  if (!revokedAt) {
    return false;
  }
  return issuedAtSeconds * 1000 <= revokedAt.getTime();
}

export async function verifyExtensionToken(
  token: string,
): Promise<ExtensionTokenPayload | null> {
  const payload = verifySignedExtensionToken(env.TRAIL_EXTENSION_JWT_SECRET, token);
  if (!payload?.sub) {
    return null;
  }

  if (await isRevoked(payload.sub, payload.iat)) {
    return null;
  }

  return payload;
}

export async function revokeExtensionTokensForUser(userId: string): Promise<void> {
  await db.$executeRaw`
    UPDATE "User"
    SET "extensionAuthRevokedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "id" = ${userId}
  `;
}
