import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { createOAuthAuthorizationCode } from "@/src/server/backend/oauth";
import { jsonError } from "@/src/server/backend/error-response";

export const runtime = "nodejs";

/**
 * OAuth client registry mapping client_id to allowed redirect_uri patterns.
 * Each client defines the schemes/hosts that are permitted for authorization callbacks.
 */
type OAuthClientConfig = {
  allowedRedirectPatterns: Array<{
    scheme: string;
    hostname?: string;
    hostnamePattern?: RegExp;
  }>;
};

const OAUTH_CLIENTS: Record<string, OAuthClientConfig> = {
  "trail-extension": {
    allowedRedirectPatterns: [
      // Chrome extension identity API callback (e.g., trail-dev.chromiumapp.org)
      { scheme: "https:", hostnamePattern: /^[a-z0-9-]+\.chromiumapp\.org$/ },
      // Production web callback
      { scheme: "https:", hostname: "app.gettrail.net" },
      // Local development
      { scheme: "http:", hostname: "localhost" },
      { scheme: "http:", hostname: "127.0.0.1" },
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
      if (url.protocol !== pattern.scheme) {
        continue;
      }
      if (pattern.hostname && url.hostname === pattern.hostname) {
        return true;
      }
      if (pattern.hostnamePattern && pattern.hostnamePattern.test(url.hostname)) {
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const responseType = url.searchParams.get("response_type") ?? "code";
  const clientId = url.searchParams.get("client_id") ?? "trail-extension";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state");
  const scope = url.searchParams.get("scope");
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") ?? "S256";
  const prompt = (url.searchParams.get("prompt") ?? "").trim().toLowerCase();
  const deviceId = url.searchParams.get("device_id");

  if (!(clientId in OAUTH_CLIENTS)) {
    return jsonError("invalid_client", "Unknown client_id.", { status: 400 });
  }
  if (!redirectUri || !isAllowedRedirectUri(clientId, redirectUri)) {
    return jsonError("invalid_request", "Invalid redirect_uri.", { status: 400 });
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

  const session = await auth.api.getSession({
    headers: new Headers(request.headers),
  });

  const forceInteractive = prompt === "select_account";
  if (!session?.user?.id || forceInteractive) {
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
    userId: session.user.id,
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
