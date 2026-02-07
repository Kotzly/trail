import { NextResponse } from "next/server";
import { env } from "@/src/env";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/billing";

  const callbackUrl = new URL("/auth/callback", url.origin);
  if (next) {
    callbackUrl.searchParams.set("next", next);
  }

  // If the user still has an auth session, the bridge flow will mint a fresh JWT
  // and send them back to the account app without showing the login UI.
  const bridgeUrl = new URL("/auth/bridge", env.TRAIL_AUTH_BASE_URL);
  bridgeUrl.searchParams.set("returnTo", callbackUrl.toString());

  return NextResponse.redirect(bridgeUrl);
}

