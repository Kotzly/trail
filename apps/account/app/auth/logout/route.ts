import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/src/lib/auth";
import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyUserToken } from "@/src/server/backend/auth/user-auth";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { revokeAllExtensionSessionsForUser } from "@/src/server/backend/oauth";
import { db } from "@trail/db";

export const runtime = "nodejs";

const BETTER_AUTH_SESSION_COOKIE = "better-auth.session_token";
const BETTER_AUTH_SESSION_COOKIE_SECURE = "__Secure-better-auth.session_token";

function getCookieValue(headers: Headers, name: string): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");
  for (const rawCookie of cookies) {
    const [rawName, ...rawValueParts] = rawCookie.trim().split("=");
    if (rawName !== name) {
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

function getAuthTokenFromCookie(headers: Headers): string | null {
  return getCookieValue(headers, AUTH_COOKIE_NAME);
}

function getSessionTokenFromCookie(headers: Headers): string | null {
  return (
    getCookieValue(headers, BETTER_AUTH_SESSION_COOKIE_SECURE) ??
    getCookieValue(headers, BETTER_AUTH_SESSION_COOKIE)
  );
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

async function revokeCurrentSession(request: Request): Promise<void> {
  const userId = await resolveUserIdForLogout(request).catch(() => null);
  const sessionToken = getSessionTokenFromCookie(request.headers);

  const promises: Promise<unknown>[] = [];

  if (userId) {
    promises.push(revokeAllExtensionSessionsForUser(userId).catch(() => undefined));
  }

  if (sessionToken) {
    // Only delete the current session, not all sessions for the user
    promises.push(db.session.delete({ where: { token: sessionToken } }).catch(() => undefined));
  }

  await Promise.all(promises);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  // GET only clears local cookies – server-side session revocation is done
  // exclusively via POST to prevent cross-site (CSRF) logout attacks.
  return buildLogoutResponse(NextResponse.redirect(new URL("/", url.origin)));
}

export async function POST(request: Request) {
  await revokeCurrentSession(request);
  return buildLogoutResponse(new NextResponse(null, { status: 204 }));
}
