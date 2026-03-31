import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/src/lib/supabase/middleware";

const protectedPrefixes = ["/trails", "/dashboard", "/settings", "/billing"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { supabaseResponse, user } = await updateSession(request);

  const needsAuth = protectedPrefixes.some((p) => pathname.startsWith(p));
  if (needsAuth && !user) {
    const callbackUrl = new URL("/auth/callback", request.nextUrl.origin);
    callbackUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(callbackUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/).*)",
  ],
};
