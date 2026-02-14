import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/src/lib/auth";
import { exchangeAuthBridgeCode } from "@/src/server/backend/auth-bridge";
import { resolveSafeNextPath } from "@/src/server/auth-redirect";

export const runtime = "nodejs";

const DEFAULT_REDIRECT = "/trails";

async function exchangeCode(code: string): Promise<string | null> {
  const result = await exchangeAuthBridgeCode(code);
  if (!result.ok || !result.jwt) {
    return null;
  }
  return result.jwt;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const nextParam = url.searchParams.get("next");
  const nextPath = resolveSafeNextPath(nextParam, DEFAULT_REDIRECT);

  if (!code) {
    const loginUrl = new URL("/auth/login", url.origin);
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl);
  }

  const accessToken = await exchangeCode(code);
  if (!accessToken) {
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
