import { randomBytes, createHash } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { resolveSafeNextPath } from "@/src/server/auth-redirect";
import { createOAuthAuthorizationCode } from "@/src/server/backend/oauth";
import { ensurePublicUser } from "@/src/server/backend/user";

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
  const host = request.headers.get("host");
  if (host) url.host = host;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const nextPath = resolveSafeNextPath(nextParam, DEFAULT_REDIRECT);
  const source = url.searchParams.get("source");

  const supabase = await createSupabaseServerClient();

  // Exchange Supabase auth code for session (sets cookies automatically via @supabase/ssr)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const loginUrl = new URL("/auth/login", url.origin);
      loginUrl.searchParams.set("next", nextPath);
      if (source) {
        loginUrl.searchParams.set("source", source);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  // Check if user is now authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = new URL("/auth/login", url.origin);
    loginUrl.searchParams.set("next", nextPath);
    if (source) {
      loginUrl.searchParams.set("source", source);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Safety net: ensure public.users row exists (the DB trigger usually
  // handles this, but there can be race conditions on first sign-up).
  await ensurePublicUser({
    id: user.id,
    email: user.email ?? "",
    name:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email ??
      "User",
    imageUrl:
      (user.user_metadata?.avatar_url as string | undefined) ?? null,
  }).catch(() => {
    // Non-critical: the DB trigger is the primary path; this is a fallback.
  });

  // Extension flow: generate PKCE code for extension relay
  if (source === "extension") {
    const codeVerifier = base64Url(randomBytes(64));
    const codeChallenge = base64Url(
      createHash("sha256").update(codeVerifier).digest(),
    );
    const redirectUri = new URL("/auth/extension-relay", url.origin).toString();
    const created = await createOAuthAuthorizationCode({
      userId: user.id,
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

    return NextResponse.redirect(relayUrl);
  }

  return NextResponse.redirect(new URL(nextPath, url.origin));
}
