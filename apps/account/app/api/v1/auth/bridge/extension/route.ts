import { getBearerToken } from "@/src/server/backend/auth/headers";
import { createAuthBridgeCodeFromExtensionToken } from "@/src/server/backend/auth-bridge";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = getBearerToken(request.headers);
  if (!token) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const result = await createAuthBridgeCodeFromExtensionToken(token);
  if (!result.ok) {
    if (result.reason === "user_not_found") {
      return jsonError("user_not_found", "User not found.", { status: 404 });
    }
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  return jsonNoStore({
    code: result.code,
    expiresAt: result.expiresAt.toISOString(),
  });
}
