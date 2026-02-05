import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/src/lib/auth";
import { env } from "@/src/env";

export const runtime = "nodejs";

const DEFAULT_REDIRECT = "/dashboard";

type ExchangeResponse = {
  snapshot?: {
    session?: {
      accessToken?: string;
    };
  };
};

async function exchangeCode(code: string): Promise<string | null> {
  const targetUrl = new URL("/v1/auth/bridge/exchange", env.TRAIL_API_BASE_URL);
  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ code }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response
    .json()
    .catch(() => null)) as ExchangeResponse | null;
  return data?.snapshot?.session?.accessToken ?? null;
}

function resolveNextPath(nextParam: string | null): string {
  if (!nextParam) {
    return DEFAULT_REDIRECT;
  }

  return nextParam.startsWith("/") ? nextParam : DEFAULT_REDIRECT;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const nextParam = url.searchParams.get("next");
  const nextPath = resolveNextPath(nextParam);

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
