import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host) url.host = host;
  const next = url.searchParams.get("next") ?? url.searchParams.get("returnTo");
  const prompt = url.searchParams.get("prompt");
  const maxAge = url.searchParams.get("maxAge");
  const source = url.searchParams.get("source");

  const callbackUrl = new URL("/auth/callback", url.origin);
  if (next) {
    callbackUrl.searchParams.set("next", next);
  }
  if (source) {
    callbackUrl.searchParams.set("source", source);
  }

  const loginUrl = new URL("/login", url.origin);
  loginUrl.searchParams.set("returnTo", callbackUrl.toString());
  if (prompt) {
    loginUrl.searchParams.set("prompt", prompt);
  }
  if (maxAge) {
    loginUrl.searchParams.set("maxAge", maxAge);
  }

  return NextResponse.redirect(loginUrl);
}
