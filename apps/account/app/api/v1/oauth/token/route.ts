import {
  exchangeOAuthAuthorizationCode,
  refreshOAuthToken,
} from "@/src/server/backend/oauth";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";

export const runtime = "nodejs";

function readString(body: unknown, key: string): string {
  if (!body || typeof body !== "object") {
    return "";
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const grantType = readString(body, "grant_type");
  const clientId = readString(body, "client_id") || "trail-extension";

  if (grantType === "authorization_code") {
    const code = readString(body, "code");
    const codeVerifier = readString(body, "code_verifier");
    const redirectUri = readString(body, "redirect_uri");
    const deviceId = readString(body, "device_id");

    if (!code || !codeVerifier || !redirectUri) {
      return jsonError("invalid_request", "Missing code exchange fields.", {
        status: 400,
      });
    }

    const result = await exchangeOAuthAuthorizationCode({
      code,
      codeVerifier,
      redirectUri,
      clientId,
      deviceId,
    });

    if (!result.ok) {
      const status = result.reason === "server_error" ? 500 : 400;
      return jsonError(result.reason, "Code exchange failed.", { status });
    }

    return jsonNoStore({
      access_token: result.tokens.accessToken,
      token_type: result.tokens.tokenType,
      expires_at: result.tokens.expiresAt,
      refresh_token: result.tokens.refreshToken,
      refresh_expires_at: result.tokens.refreshExpiresAt,
      scope: result.tokens.scope,
    });
  }

  if (grantType === "refresh_token") {
    const refreshToken = readString(body, "refresh_token");
    if (!refreshToken) {
      return jsonError("invalid_request", "Missing refresh token.", {
        status: 400,
      });
    }

    const result = await refreshOAuthToken({
      refreshToken,
      clientId,
    });

    if (!result.ok) {
      return jsonError(result.reason, "Token refresh failed.", { status: 400 });
    }

    return jsonNoStore({
      access_token: result.tokens.accessToken,
      token_type: result.tokens.tokenType,
      expires_at: result.tokens.expiresAt,
      refresh_token: result.tokens.refreshToken,
      refresh_expires_at: result.tokens.refreshExpiresAt,
      scope: result.tokens.scope,
    });
  }

  return jsonError("unsupported_grant_type", "Unsupported grant type.", {
    status: 400,
  });
}

