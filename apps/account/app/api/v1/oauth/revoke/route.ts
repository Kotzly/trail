import { revokeOAuthRefreshToken } from "@/src/server/backend/oauth";
import { jsonFail } from "@/src/server/backend/error-response";
import { oauthRevokeBodySchema } from "@/src/server/api/schemas";
import { parseBody } from "@/src/server/api/validate";
import { rateLimit } from "@/src/server/api/rate-limit";
import { corsHeaders, optionsResponse } from "@/src/server/api/cors";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(ip, "auth");
  if (!rl.ok) {
    return jsonFail("RATE_LIMITED", "Too many requests", { status: 429 });
  }

  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);

  const body = await request.json().catch(() => null);

  const parsed = parseBody(oauthRevokeBodySchema, body);
  if (!parsed.ok) {
    return jsonFail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input", { status: 400, headers: cors });
  }

  const refreshToken = parsed.data.refresh_token?.trim() || null;
  if (refreshToken) {
    await revokeOAuthRefreshToken(refreshToken);
  }
  return new Response(null, { status: 204, headers: cors });
}

