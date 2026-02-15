import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { AUTH_COOKIE_NAME } from "@/src/lib/auth";
import { resolveSafeNextPath } from "@/src/server/auth-redirect";

export const runtime = "nodejs";

const DEFAULT_REDIRECT = "/trails";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextParam = url.searchParams.get("next");
  const nextPath = resolveSafeNextPath(nextParam, DEFAULT_REDIRECT);
  const headers = new Headers(request.headers);
  const session = await auth.api.getSession({ headers });
  const tokenResponse = await auth.api.getToken({ headers }).catch(() => null);
  const accessToken = tokenResponse?.token;
  if (!session?.user?.id || !accessToken) {
    const loginUrl = new URL("/auth/login", url.origin);
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.redirect(new URL(nextPath, url.origin));
  response.cookies.set(AUTH_COOKIE_NAME, accessToken, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
