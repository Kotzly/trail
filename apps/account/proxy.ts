import { NextResponse, type NextRequest } from "next/server";
import { auth0, getAuthSession, isAuthBypassed } from "@/src/lib/auth0";

const protectedPrefixes = ["/dashboard", "/settings", "/billing", "/extension"];

export async function proxy(request: NextRequest) {
  if (isAuthBypassed()) {
    return NextResponse.next();
  }

  const authRes = await auth0.middleware(request);
  const { pathname } = request.nextUrl;

  const needsAuth = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (!needsAuth) {
    return authRes;
  }

  const session = await getAuthSession(request);
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", request.nextUrl.origin));
  }

  return authRes;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"]
};
