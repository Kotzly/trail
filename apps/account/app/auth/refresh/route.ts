import { NextResponse } from "next/server";

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
  const bridgeUrl = new URL("/auth/bridge", url.origin);
  bridgeUrl.searchParams.set("returnTo", callbackUrl.toString());

  return NextResponse.redirect(bridgeUrl);
}
