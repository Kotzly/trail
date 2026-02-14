import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { createOAuthAuthorizationCode } from "@/src/server/backend/oauth";
import { jsonError } from "@/src/server/backend/error-response";

export const runtime = "nodejs";

function isAllowedRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "chrome-extension:") {
      return true;
    }
    if (url.protocol === "https:" && url.hostname.endsWith(".chromiumapp.org")) {
      return true;
    }
    if (url.protocol === "https:" && url.hostname === "app.gettrail.net") {
      return true;
    }
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
      return true;
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

  if (!redirectUri || !isAllowedRedirectUri(redirectUri)) {
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
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("returnTo", url.toString());
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
