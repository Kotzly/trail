import { AUTH_COOKIE_NAME } from "@/src/lib/auth";
import { getCookieValue } from "@/src/lib/cookies";
import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { verifyUserToken } from "@/src/server/backend/auth/user-auth";
import { getExtensionConfig } from "@/src/server/backend/extension-config";
import { jsonNoStore } from "@/src/server/backend/response";
import { db } from "@trail/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const bearer = getBearerToken(request.headers);
  if (bearer) {
    const extension = await verifyExtensionToken(bearer);
    if (extension?.sub) {
      return jsonNoStore({
        status: "authenticated",
        source: "extension",
        userId: extension.sub,
        sessionId: extension.sid ?? null,
        authSessionVersion: extension.ver ?? null,
        ...getExtensionConfig(),
      });
    }

    // Fallback: try verifying as a web user JWT bearer token
    const userBearer = await verifyUserToken(bearer);
    if (userBearer?.sub) {
      const record = await db.user.findUnique({
        where: { id: userBearer.sub },
        select: { authSessionVersion: true },
      });
      return jsonNoStore({
        status: "authenticated",
        source: "web",
        userId: userBearer.sub,
        authSessionVersion: record?.authSessionVersion ?? null,
        ...getExtensionConfig(),
      });
    }
  }

  const cookieToken = getCookieValue(request.headers, AUTH_COOKIE_NAME);
  if (cookieToken) {
    const user = await verifyUserToken(cookieToken);
    if (user?.sub) {
      const record = await db.user.findUnique({
        where: { id: user.sub },
        select: { authSessionVersion: true },
      });
      return jsonNoStore({
        status: "authenticated",
        source: "web",
        userId: user.sub,
        authSessionVersion: record?.authSessionVersion ?? null,
        ...getExtensionConfig(),
      });
    }
  }

  return jsonNoStore({
    status: "guest",
    ...getExtensionConfig(),
  });
}

