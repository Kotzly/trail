import {
  DEFAULT_EXTENSION_TOKEN_TTL_SECONDS,
  createSignedExtensionToken,
  verifySignedExtensionToken,
} from "@trail/auth-token";
import { env } from "@/src/env";

const TOKEN_TTL_SECONDS = DEFAULT_EXTENSION_TOKEN_TTL_SECONDS;

export function createExtensionAccessToken(
  userId: string,
  ttlSeconds: number = TOKEN_TTL_SECONDS,
): { token: string; expiresAt: string } {
  return createSignedExtensionToken(
    env.TRAIL_EXTENSION_JWT_SECRET,
    userId,
    ttlSeconds,
  );
}

export function verifyExtensionAccessToken(token: string) {
  return verifySignedExtensionToken(env.TRAIL_EXTENSION_JWT_SECRET, token);
}
