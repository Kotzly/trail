import {
  type ExtensionTokenPayload,
  verifySignedExtensionToken,
} from "@trail/trpc";
import { db } from "@trail/db";
import { env } from "@/src/env";

export async function verifyExtensionToken(
  token: string,
): Promise<ExtensionTokenPayload | null> {
  const payload = verifySignedExtensionToken(env.TRAIL_EXTENSION_JWT_SECRET, token);
  if (!payload?.sub) {
    return null;
  }
  if (!payload.sid || typeof payload.ver !== "number") {
    return null;
  }

  const [user, session] = await Promise.all([
    db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, authSessionVersion: true },
    }),
    db.extensionDeviceSession.findUnique({
      where: { id: payload.sid },
      select: {
        id: true,
        userId: true,
        status: true,
        revokedAt: true,
      },
    }),
  ]);

  if (!user || !session) {
    return null;
  }
  if (session.userId !== payload.sub) {
    return null;
  }
  if (session.status !== "ACTIVE" || session.revokedAt) {
    return null;
  }
  if (user.authSessionVersion !== payload.ver) {
    return null;
  }

  void db.extensionDeviceSession
    .update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => undefined);

  return payload;
}
