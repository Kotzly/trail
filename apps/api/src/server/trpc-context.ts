import { db } from "@trail/db";
import type { AppContext, AppSession, AppUser } from "@trail/trpc";

function getInternalSession(headers: Headers): AppSession {
  const expectedKey = process.env.TRAIL_INTERNAL_API_KEY;
  if (!expectedKey) {
    return null;
  }

  const providedKey = headers.get("x-trail-internal-key");
  if (!providedKey || providedKey !== expectedKey) {
    return null;
  }

  const rawUser = headers.get("x-trail-user");
  if (!rawUser) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawUser) as Partial<AppUser> | null;
    if (!parsed || typeof parsed.id !== "string") {
      return null;
    }

    const user: AppUser = {
      id: parsed.id,
      email: typeof parsed.email === "string" ? parsed.email : null,
      name: typeof parsed.name === "string" ? parsed.name : null,
      imageUrl: typeof parsed.imageUrl === "string" ? parsed.imageUrl : null
    };

    return { user };
  } catch {
    return null;
  }
}

export async function createTRPCContext(req?: Request): Promise<AppContext> {
  const headers = req?.headers ?? new Headers();
  const session = getInternalSession(headers);

  return {
    db,
    session,
    headers
  };
}
