import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/src/lib/auth";
import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyUserToken } from "@/src/server/backend/auth/user-auth";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { revokeAllExtensionSessionsForUser } from "@/src/server/backend/oauth";
import { db } from "@trail/db";

export const runtime = "nodejs";

function getAuthTokenFromCookie(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");
  for (const rawCookie of cookies) {
    const [rawName, ...rawValueParts] = rawCookie.trim().split("=");
    if (rawName !== AUTH_COOKIE_NAME) {
      continue;
    }
    const rawValue = rawValueParts.join("=");
    if (!rawValue) {
      return null;
    }
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return null;
}

async function resolveUserIdForLogout(request: Request): Promise<string | null> {
  const token =
    getBearerToken(request.headers) ?? getAuthTokenFromCookie(request.headers);
  if (!token) {
    return null;
  }

  const user = await verifyUserToken(token);
  if (user?.sub) {
    return user.sub;
  }

  const extensionUser = await verifyExtensionToken(token);
  if (!extensionUser?.sub) {
    return null;
  }

  return extensionUser.sub;
}

function buildLogoutResponse(response: NextResponse) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
    maxAge: 0,
  });
  response.cookies.set("better-auth.session_token", "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
    maxAge: 0,
  });
  response.cookies.set("__Secure-better-auth.session_token", "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = await resolveUserIdForLogout(request).catch(() => null);
  if (userId) {
    await Promise.all([
      revokeAllExtensionSessionsForUser(userId).catch(() => undefined),
      db.session.deleteMany({ where: { userId } }).catch(() => undefined),
    ]);
  }
  return buildLogoutResponse(NextResponse.redirect(new URL("/", url.origin)));
}

export async function POST(request: Request) {
  const userId = await resolveUserIdForLogout(request).catch(() => null);
  if (userId) {
    await Promise.all([
      revokeAllExtensionSessionsForUser(userId).catch(() => undefined),
      db.session.deleteMany({ where: { userId } }).catch(() => undefined),
    ]);
  }
  return buildLogoutResponse(new NextResponse(null, { status: 204 }));
}
