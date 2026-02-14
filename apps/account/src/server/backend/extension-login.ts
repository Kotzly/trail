import { randomBytes } from "crypto";
import { db } from "@trail/db";

const CODE_BYTES = 16;
const CODE_TTL_MINUTES = 10;

function createCode() {
  return randomBytes(CODE_BYTES).toString("hex");
}

export async function createExtensionLoginCode(
  userId: string,
  preferredCode?: string,
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000);

  if (preferredCode) {
    const existing = await db.extensionLoginCode.findUnique({
      where: { code: preferredCode },
    });
    if (existing) {
      if (existing.userId !== userId) {
        throw new Error("Extension login code collision.");
      }

      if (existing.usedAt || existing.expiresAt < now) {
        await db.extensionLoginCode.update({
          where: { id: existing.id },
          data: { usedAt: null, expiresAt },
        });
      }

      return existing.code;
    }

    await db.extensionLoginCode.create({
      data: {
        code: preferredCode,
        userId,
        expiresAt,
      },
    });
    return preferredCode;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = createCode();
    try {
      const record = await db.extensionLoginCode.create({
        data: {
          code,
          userId,
          expiresAt,
        },
      });
      return record.code;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error("Unable to generate extension login code.");
}
