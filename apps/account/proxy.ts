import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/src/env";

const protectedPrefixes = ["/dashboard", "/settings", "/extension"];
const AUTH_COOKIE_NAME = "trail_auth_session";

export async function proxy(request: NextRequest) {
  if (env.ACCOUNT_AUTH_BYPASS) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;
  const needsAuth = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );
  if (!needsAuth) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL("/auth/login", request.nextUrl.origin);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
