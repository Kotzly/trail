import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { resolveSafeNextPath } from "@/src/server/auth-redirect";
import { ensurePublicUser } from "@/src/server/backend/user";

export const runtime = "nodejs";

const DEFAULT_REDIRECT = "/trails";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const nextPath = resolveSafeNextPath(nextParam, DEFAULT_REDIRECT);

  const supabase = await createSupabaseServerClient();

  // Exchange Supabase auth code for session (sets cookies automatically via @supabase/ssr)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const loginUrl = new URL("/auth/login", url.origin);
      loginUrl.searchParams.set("next", nextPath);
      return NextResponse.redirect(loginUrl);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = new URL("/auth/login", url.origin);
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl);
  }

  // Safety net: ensure public.users row exists (the DB trigger usually
  // handles this, but there can be race conditions on first sign-up).
  await ensurePublicUser(
    {
      id: user.id,
      email: user.email ?? "",
      name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        user.email ??
        "User",
      imageUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    },
    supabase,
  ).catch((err) => {
    console.error("ensurePublicUser failed in auth callback:", err);
  });

  return NextResponse.redirect(new URL(nextPath, url.origin));
}
