import { randomBytes } from "crypto";
import { db } from "@trail/db";

const CODE_BYTES = 16;
const CODE_TTL_MINUTES = 10;

function createCode() {
  return randomBytes(CODE_BYTES).toString("hex");
}

export async function createExtensionLoginCode(userId: string) {
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = createCode();
    try {
      const record = await db.extensionLoginCode.create({
        data: {
          code,
          userId,
          expiresAt
        }
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
