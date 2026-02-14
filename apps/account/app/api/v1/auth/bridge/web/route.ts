import { getAuthTokenFromCookies } from "@/src/lib/auth";
import { createAuthBridgeCodeFromWebToken } from "@/src/server/backend/auth-bridge";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";

export const runtime = "nodejs";

export async function POST() {
  const token = await getAuthTokenFromCookies();
  if (!token) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const result = await createAuthBridgeCodeFromWebToken(token);
  if (!result.ok) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  return jsonNoStore({
    code: result.code,
    expiresAt: result.expiresAt.toISOString(),
  });
}
