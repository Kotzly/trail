import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = ["/trails", "/dashboard", "/settings", "/billing"];
const AUTH_COOKIE_NAME = "trail_auth_session";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const needsAuth = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );
  if (!needsAuth) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    // Redirect to /auth/callback instead of /auth/login so the callback
    // can silently re-mint a JWT from the still-valid Better Auth session.
    // If the session is also expired, the callback itself redirects to login.
    const callbackUrl = new URL("/auth/callback", request.nextUrl.origin);
    callbackUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(callbackUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/).*)",
  ],
};
