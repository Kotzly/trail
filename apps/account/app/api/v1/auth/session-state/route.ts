import { AUTH_COOKIE_NAME } from "@/src/lib/auth";
import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { verifyUserToken } from "@/src/server/backend/auth/user-auth";
import { jsonNoStore } from "@/src/server/backend/response";
import { db } from "@trail/db";

export const runtime = "nodejs";

function getCookieToken(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");
  for (const rawCookie of cookies) {
    const [rawName, ...rest] = rawCookie.trim().split("=");
    if (rawName !== AUTH_COOKIE_NAME) {
      continue;
    }
    const value = rest.join("=");
    if (!value) {
      return null;
    }
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

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
      });
    }
  }

  const cookieToken = getCookieToken(request.headers);
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
      });
    }
  }

  return jsonNoStore({
    status: "guest",
  });
}

