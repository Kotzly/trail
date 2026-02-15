import { db } from "@trail/db";
import type { AppContext, AppSession } from "@trail/trpc";
import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyUserToken } from "@/src/server/backend/auth/user-auth";
import { ensureUser } from "@/src/server/backend/user";
import { devUser, getAuthBypassState } from "@/src/lib/auth";

const AUTH_COOKIE_NAME = "trail_auth_session";

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

async function getRequestSession(headers: Headers): Promise<AppSession> {
  if (getAuthBypassState()) {
    return {
      user: {
        id: devUser.id,
        email: devUser.email,
        name: devUser.name,
        imageUrl: devUser.imageUrl ?? null,
      },
    };
  }

  const token = getBearerToken(headers) ?? getAuthTokenFromCookie(headers);
  if (!token) {
    return null;
  }

  const authUser = await verifyUserToken(token);
  if (!authUser) {
    return null;
  }

  const user = await ensureUser(authUser);
  return user ? { user } : null;
}

export async function createTRPCContext(req?: Request): Promise<AppContext> {
  const headers = req?.headers ?? new Headers();
  const session = await getRequestSession(headers);

  return {
    db,
    session,
    headers,
  };
}
