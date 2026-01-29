import { NextResponse } from "next/server";
import { verifyExtensionAccessToken } from "@/src/server/extension-auth";

export const runtime = "nodejs";

function getBearerToken(headers: Headers): string | null {
  const auth = headers.get("authorization") ?? headers.get("Authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export async function POST(request: Request) {
  const token = getBearerToken(request.headers);
  if (!token || !verifyExtensionAccessToken(token)) {
    return NextResponse.json(
      { code: "auth", message: "Unauthorized", retryable: false },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const returnUrl =
    body?.returnUrl && typeof body.returnUrl === "string"
      ? body.returnUrl
      : "https://app.gettrail.net/billing";

  return NextResponse.json({
    url: returnUrl,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });
}
