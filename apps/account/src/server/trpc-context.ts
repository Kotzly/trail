import { db } from "@trail/db";
import type { AppContext, AppSession } from "@trail/trpc";
import { auth0 } from "@/src/lib/auth0";
import { ensureUser } from "@/src/server/user";

export async function createTRPCContext(req?: Request): Promise<AppContext> {
  const session = await auth0.getSession();
  const user = session?.user ? await ensureUser(session.user) : null;
  const appSession: AppSession = user ? { user } : null;

  return {
    db,
    session: appSession,
    headers: req?.headers ?? new Headers()
  };
}
