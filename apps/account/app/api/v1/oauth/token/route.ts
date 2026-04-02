import {
  exchangeOAuthAuthorizationCode,
  refreshOAuthToken,
} from "@/src/server/backend/oauth";
import { jsonFail, jsonOk } from "@/src/server/backend/error-response";
import { oauthTokenBodySchema } from "@/src/server/api/schemas";
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

  const parsed = parseBody(oauthTokenBodySchema, body);
  if (!parsed.ok) {
    return jsonFail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input", { status: 400, headers: cors });
  }

  if (parsed.data.grant_type === "authorization_code") {
    const { client_id: clientId, code, code_verifier: codeVerifier, redirect_uri: redirectUri, device_id: deviceId } = parsed.data;

    const result = await exchangeOAuthAuthorizationCode({
      code,
      codeVerifier,
      redirectUri,
      clientId,
      deviceId,
    });

    if (!result.ok) {
      const status = result.reason === "server_error" ? 500 : 400;
      return jsonFail(result.reason, "Code exchange failed.", { status, headers: cors });
    }

    return jsonOk({
      access_token: result.tokens.accessToken,
      token_type: result.tokens.tokenType,
      expires_at: result.tokens.expiresAt,
      refresh_token: result.tokens.refreshToken,
      refresh_expires_at: result.tokens.refreshExpiresAt,
      scope: result.tokens.scope,
    }, { headers: cors });
  }

  if (parsed.data.grant_type === "refresh_token") {
    const { client_id: clientId, refresh_token: refreshToken } = parsed.data;

    const result = await refreshOAuthToken({
      refreshToken,
      clientId,
    });

    if (!result.ok) {
      return jsonFail(result.reason, "Token refresh failed.", { status: 400, headers: cors });
    }

    return jsonOk({
      access_token: result.tokens.accessToken,
      token_type: result.tokens.tokenType,
      expires_at: result.tokens.expiresAt,
      refresh_token: result.tokens.refreshToken,
      refresh_expires_at: result.tokens.refreshExpiresAt,
      scope: result.tokens.scope,
    }, { headers: cors });
  }

  return jsonFail("unsupported_grant_type", "Unsupported grant type.", {
    status: 400,
    headers: cors,
  });
}

