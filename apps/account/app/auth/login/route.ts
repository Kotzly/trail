import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TRAIL_AUTH_BASE_URL =
  process.env.TRAIL_AUTH_BASE_URL ?? "https://auth.gettrail.net";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? url.searchParams.get("returnTo");

  const callbackUrl = new URL("/auth/callback", url.origin);
  if (next) {
    callbackUrl.searchParams.set("next", next);
  }

  const loginUrl = new URL("/login", TRAIL_AUTH_BASE_URL);
  loginUrl.searchParams.set("returnTo", callbackUrl.toString());

  return NextResponse.redirect(loginUrl);
}
