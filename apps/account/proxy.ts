import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/src/env";

const protectedPrefixes = ["/trails", "/dashboard", "/settings"];
const AUTH_COOKIE_NAME = "trail_auth_session";

function decodeJwtPayload(token: string): { exp?: number } | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const payload = parts[1] ?? "";
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    // Middleware runs in the Edge runtime. Use Web APIs, not Node Buffers.
    const json = atob(padded);
    return JSON.parse(json) as { exp?: number };
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    // If we can't parse it, treat it as expired for UX: force refresh.
    return true;
  }
  // Add a small clock skew window.
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowSeconds + 15;
}

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

  if (isTokenExpired(token)) {
    const refreshUrl = new URL("/auth/refresh", request.nextUrl.origin);
    refreshUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(refreshUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
