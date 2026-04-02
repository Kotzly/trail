import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createOAuthAuthorizationCode } from "@/src/server/backend/oauth";
import { jsonFail } from "@/src/server/backend/error-response";
import { oauthAuthorizeQuerySchema } from "@/src/server/api/schemas";
import { parseQuery } from "@/src/server/api/validate";
import { rateLimit } from "@/src/server/api/rate-limit";
import { corsHeaders, optionsResponse } from "@/src/server/api/cors";

export const runtime = "nodejs";

/**
 * OAuth client registry mapping client_id to allowed redirect_uri patterns.
 * Each client defines the schemes/hosts that are permitted for authorization callbacks.
 */
type OAuthClientConfig = {
  allowedRedirectPatterns: Array<{
    scheme: string;
    hostname?: string;
  }>;
};

/**
 * Build the explicit allowlist of *.chromiumapp.org hostnames for the
 * Chrome extension identity API callback.
 *
 * Production: set OAUTH_ALLOWED_EXTENSION_HOSTS (comma-separated) to the
 * actual CWS extension host(s), e.g. "abcdefghij...chromiumapp.org".
 * Development: "trail-dev.chromiumapp.org" is included automatically.
 */
function getAllowedExtensionHosts(): string[] {
  const hosts: string[] = [];

  const envHosts = process.env.OAUTH_ALLOWED_EXTENSION_HOSTS;
  if (envHosts) {
    for (const raw of envHosts.split(",")) {
      const h = raw.trim().toLowerCase();
      if (h && h.endsWith(".chromiumapp.org")) {
        hosts.push(h);
      }
    }
  }

  // In non-production environments, include the dev extension host
  if (process.env.NODE_ENV !== "production") {
    const devHost = "trail-dev.chromiumapp.org";
    if (!hosts.includes(devHost)) {
      hosts.push(devHost);
    }
  }

  return hosts;
}

const ALLOWED_EXTENSION_HOSTS = new Set(getAllowedExtensionHosts());

const OAUTH_CLIENTS: Record<string, OAuthClientConfig> = {
  "trail-extension": {
    allowedRedirectPatterns: [
      // Chrome extension identity API callbacks — explicit per-extension-ID hosts only
      ...Array.from(ALLOWED_EXTENSION_HOSTS).map((hostname) => ({
        scheme: "https:" as const,
        hostname,
      })),
      // Production web callback
      { scheme: "https:", hostname: "app.gettrail.net" },
      // Local development
      ...(process.env.NODE_ENV !== "production"
        ? [
            { scheme: "http:" as const, hostname: "localhost" },
            { scheme: "http:" as const, hostname: "127.0.0.1" },
          ]
        : []),
    ],
  },
};

function isAllowedRedirectUri(clientId: string, value: string): boolean {
  const client = OAUTH_CLIENTS[clientId];
  if (!client) {
    return false;
  }

  try {
    const url = new URL(value);
    for (const pattern of client.allowedRedirectPatterns) {
      if (url.protocol === pattern.scheme && url.hostname === pattern.hostname) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function redirectWithOAuthError(input: {
  redirectUri: string;
  error: string;
  state?: string | null;
}) {
  const target = new URL(input.redirectUri);
  target.searchParams.set("error", input.error);
  if (input.state) {
    target.searchParams.set("state", input.state);
  }
  return NextResponse.redirect(target);
}

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(ip, "auth");
  if (!rl.ok) {
    return jsonFail("RATE_LIMITED", "Too many requests", { status: 429 });
  }

  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);

  const url = new URL(request.url);

  const parsed = parseQuery(oauthAuthorizeQuerySchema, url.searchParams);
  if (!parsed.ok) {
    return jsonFail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input", { status: 400, headers: cors });
  }
  const {
    response_type: responseType,
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    prompt: rawPrompt,
    device_id: deviceId,
  } = parsed.data;
  const prompt = rawPrompt.trim().toLowerCase();

  if (!(clientId in OAUTH_CLIENTS)) {
    return jsonFail("invalid_client", "Unknown client_id.", { status: 400, headers: cors });
  }
  if (!redirectUri || !isAllowedRedirectUri(clientId, redirectUri)) {
    return jsonFail("invalid_request", "Invalid redirect_uri.", { status: 400, headers: cors });
  }
  if (responseType !== "code") {
    return redirectWithOAuthError({
      redirectUri,
      error: "unsupported_response_type",
      state,
    });
  }
  if (!codeChallenge || codeChallenge.length < 43 || codeChallenge.length > 128) {
    return redirectWithOAuthError({
      redirectUri,
      error: "invalid_request",
      state,
    });
  }
  if (codeChallengeMethod !== "S256") {
    return redirectWithOAuthError({
      redirectUri,
      error: "invalid_request",
      state,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const forceInteractive = prompt === "select_account";
  if (!user || forceInteractive) {
    if (prompt === "none") {
      return redirectWithOAuthError({
        redirectUri,
        error: "login_required",
        state,
      });
    }
    // Strip the prompt parameter from returnTo URL to prevent redirect loop
    // after successful login/account selection
    const returnToUrl = new URL(url.toString());
    returnToUrl.searchParams.delete("prompt");
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("returnTo", returnToUrl.toString());
    if (forceInteractive) {
      loginUrl.searchParams.set("prompt", "select_account");
      loginUrl.searchParams.set("maxAge", "0");
    }
    return NextResponse.redirect(loginUrl);
  }

  const created = await createOAuthAuthorizationCode({
    userId: user.id,
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    scope,
    state,
    deviceId,
  });

  const target = new URL(redirectUri);
  target.searchParams.set("code", created.code);
  if (state) {
    target.searchParams.set("state", state);
  }

  return NextResponse.redirect(target);
}
