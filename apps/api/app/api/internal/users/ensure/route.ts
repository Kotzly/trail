import { ensureUser, type AuthUser } from "@/src/server/user";
import { requireInternalKey } from "@/src/server/internal-auth";
import { jsonNoStore } from "@/src/server/response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = requireInternalKey(request.headers);
  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const authUser = body?.user as AuthUser | undefined;

  if (!authUser) {
    return jsonNoStore({ user: null });
  }

  const user = await ensureUser(authUser);
  return jsonNoStore({ user });
}
