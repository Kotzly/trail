import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/src/lib/supabase/middleware";

const PUBLIC_PATHS = ["/login", "/auth/", "/api/"];

export async function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  // Supabase OAuth may redirect the auth code to the Site URL root instead of
  // /auth/callback when the redirectTo origin isn't in the allow-list (e.g.
  // Tailscale IP). Catch it here and forward to the callback handler.
  if (
    pathname === "/" &&
    searchParams.has("code") &&
    !searchParams.has("next")
  ) {
    const origin = `${request.nextUrl.protocol}//${request.headers.get("host")}`;
    const callbackUrl = new URL("/auth/callback", origin);
    callbackUrl.searchParams.set("code", searchParams.get("code")!);
    return NextResponse.redirect(callbackUrl);
  }

  const { supabaseResponse, user } = await updateSession(request);

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
