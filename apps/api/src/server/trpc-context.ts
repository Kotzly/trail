import { db } from "@trail/db";
import type { AppContext, AppSession, AppUser } from "@trail/trpc";
import { ensureUser, type Auth0User } from "@/src/server/user";

function getInternalAuthKey(headers: Headers): string | null {
  const expectedKey = process.env.TRAIL_INTERNAL_API_KEY;
  if (!expectedKey) {
    return null;
  }

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
      imageUrl: typeof parsed.imageUrl === "string" ? parsed.imageUrl : null
    };
  } catch {
    return null;
  }
}

function parseAuth0User(rawUser: string): Auth0User | null {
  try {
    const parsed = JSON.parse(rawUser) as Partial<Auth0User> | null;
    if (!parsed || typeof parsed.sub !== "string") {
      return null;
    }

    return {
      sub: parsed.sub,
      email: typeof parsed.email === "string" ? parsed.email : undefined,
      name: typeof parsed.name === "string" ? parsed.name : undefined,
      picture: typeof parsed.picture === "string" ? parsed.picture : undefined
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

  const rawAuth0User = headers.get("x-trail-auth0-user");
  if (!rawAuth0User) {
    return null;
  }

  const auth0User = parseAuth0User(rawAuth0User);
  if (!auth0User) {
    return null;
  }

  const user = await ensureUser(auth0User);
  return user ? { user } : null;
}

export async function createTRPCContext(req?: Request): Promise<AppContext> {
  const headers = req?.headers ?? new Headers();
  const session = await getInternalSession(headers);

  return {
    db,
    session,
    headers
  };
}
