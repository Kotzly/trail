import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/src/lib/auth";
import { getCookieValue } from "@/src/lib/cookies";
import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyUserToken } from "@/src/server/backend/auth/user-auth";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { revokeAllExtensionSessionsForUser } from "@/src/server/backend/oauth";
import { db } from "@trail/db";

export const runtime = "nodejs";

const BETTER_AUTH_SESSION_COOKIE = "better-auth.session_token";
const BETTER_AUTH_SESSION_COOKIE_SECURE = "__Secure-better-auth.session_token";

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
  if (token) {
    const user = await verifyUserToken(token);
    if (user?.sub) {
      return user.sub;
    }

    const extensionUser = await verifyExtensionToken(token);
    if (extensionUser?.sub) {
      return extensionUser.sub;
    }
  }

  // Fall back to Better Auth session cookie to resolve the user
  const sessionToken = getSessionTokenFromCookie(request.headers);
  if (sessionToken) {
    const session = await db.session
      .findUnique({ where: { token: sessionToken }, select: { userId: true } })
      .catch(() => null);
    if (session?.userId) {
      return session.userId;
    }
  }

  return null;
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

export async function GET() {
  // GET must NOT clear cookies or mutate state — doing so enables CSRF logout
  // attacks (e.g. <img src="/auth/logout">). All logout must go through POST.
  return new NextResponse("Method Not Allowed. Use POST to log out.", {
    status: 405,
    headers: { Allow: "POST" },
  });
}

export async function POST(request: Request) {
  await revokeCurrentSession(request);
  return buildLogoutResponse(new NextResponse(null, { status: 204 }));
}
