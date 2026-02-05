import { getBearerToken } from "@/src/server/auth/headers";
import { verifyUserToken } from "@/src/server/auth/user-auth";
import {
  createConnectSession,
  CONNECT_POLL_INTERVAL_MS,
} from "@/src/server/connect-sessions";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { ensureUser } from "@/src/server/user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = getBearerToken(request.headers);
  const authUser = await verifyUserToken(token);
  if (!authUser) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const user = await ensureUser(authUser);
  if (!user) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const session = await createConnectSession(user.id);

  return jsonNoStore({
    id: session.id,
    expiresAt: session.expiresAt.toISOString(),
    pollIntervalMs: CONNECT_POLL_INTERVAL_MS,
  });
}
