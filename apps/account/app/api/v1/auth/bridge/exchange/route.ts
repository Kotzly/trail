import { buildAccountSnapshot } from "@/src/server/backend/account-snapshot";
import { exchangeAuthBridgeCode } from "@/src/server/backend/auth-bridge";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!code) {
    return jsonError("code_required", "Code is required.", { status: 400 });
  }

  const result = await exchangeAuthBridgeCode(code);
  if (!result.ok) {
    const errorCode =
      result.reason === "expired" ? "code_expired" : "code_invalid";
    const message =
      result.reason === "expired" ? "Code expired." : "Code is invalid.";
    return jsonError(errorCode, message, { status: 404 });
  }

  const snapshot = buildAccountSnapshot({
    user: result.user,
    accessToken: result.jwt,
    expiresAt: result.jwtExpiresAt ? result.jwtExpiresAt.toISOString() : null,
    onboardingSeenAt: result.user.onboardingSeenAt,
  });

  return jsonNoStore({ snapshot });
}
