import { db } from "@trail/db";
import type { AppContext, AppSession, AppUser } from "@trail/trpc";
import { getBearerToken } from "@/src/server/auth/headers";
import { verifyUserToken } from "@/src/server/auth/user-auth";
import { ensureUser } from "@/src/server/user";
import { env } from "@/src/env";

function getInternalAuthKey(headers: Headers): string | null {
  const expectedKey = env.TRAIL_INTERNAL_API_KEY;

  const providedKey = headers.get("x-trail-internal-key");
  if (!providedKey || providedKey !== expectedKey) {
    return null;
  }

  return expectedKey;
}

function parseAppUser(rawUser: string): AppUser | null {
  try {
    const parsed = JSON.parse(rawUser) as Partial<AppUser> | null;
    if (!parsed || typeof parsed.id !== "string") {
      return null;
    }

    return {
      id: parsed.id,
      email: typeof parsed.email === "string" ? parsed.email : null,
      name: typeof parsed.name === "string" ? parsed.name : null,
      imageUrl: typeof parsed.imageUrl === "string" ? parsed.imageUrl : null,
    };
  } catch {
    return null;
  }
}

async function getInternalSession(headers: Headers): Promise<AppSession> {
  if (!getInternalAuthKey(headers)) {
    return null;
  }

  const rawUser = headers.get("x-trail-user");
  if (rawUser) {
    const user = parseAppUser(rawUser);
    return user ? { user } : null;
  }

  const token = getBearerToken(headers);
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
  const session = await getInternalSession(headers);

  return {
    db,
    session,
    headers,
  };
}
