import { randomBytes, createHash } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { AUTH_COOKIE_NAME } from "@/src/lib/auth";
import { resolveSafeNextPath } from "@/src/server/auth-redirect";
import { createOAuthAuthorizationCode } from "@/src/server/backend/oauth";

export const runtime = "nodejs";

const DEFAULT_REDIRECT = "/trails";

function base64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextParam = url.searchParams.get("next");
  const nextPath = resolveSafeNextPath(nextParam, DEFAULT_REDIRECT);
  const source = url.searchParams.get("source");
  const headers = new Headers(request.headers);
  const session = await auth.api.getSession({ headers });
  const tokenResponse = await auth.api.getToken({ headers }).catch(() => null);
  const accessToken = tokenResponse?.token;
  if (!session?.user?.id || !accessToken) {
    const loginUrl = new URL("/auth/login", url.origin);
    loginUrl.searchParams.set("next", nextPath);
    if (source) {
      loginUrl.searchParams.set("source", source);
    }
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.redirect(new URL(nextPath, url.origin));
  response.cookies.set(AUTH_COOKIE_NAME, accessToken, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  if (source === "extension") {
    const codeVerifier = base64Url(randomBytes(64));
    const codeChallenge = base64Url(
      createHash("sha256").update(codeVerifier).digest(),
    );
    const redirectUri = new URL("/auth/extension-relay", url.origin).toString();
    const created = await createOAuthAuthorizationCode({
      userId: session.user.id,
      clientId: "trail-extension",
      redirectUri,
      codeChallenge,
      codeChallengeMethod: "S256",
    });

    const relayUrl = new URL("/auth/extension-relay", url.origin);
    relayUrl.searchParams.set("code", created.code);
    relayUrl.searchParams.set("codeVerifier", codeVerifier);
    relayUrl.searchParams.set("redirectUri", redirectUri);
    relayUrl.searchParams.set("next", nextPath);

    const relayResponse = NextResponse.redirect(relayUrl);
    relayResponse.cookies.set(AUTH_COOKIE_NAME, accessToken, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return relayResponse;
  }

  return response;
}
