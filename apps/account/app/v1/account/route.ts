import { NextResponse } from "next/server";
import { db } from "@trail/db";
import { buildAccountSnapshot } from "@/src/server/account-snapshot";
import { verifyExtensionAccessToken } from "@/src/server/extension-auth";

export const runtime = "nodejs";

function getBearerToken(headers: Headers): string | null {
  const auth = headers.get("authorization") ?? headers.get("Authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export async function GET(request: Request) {
  const token = getBearerToken(request.headers);
  if (!token) {
    return NextResponse.json(buildAccountSnapshot({ user: null }));
  }

  const payload = verifyExtensionAccessToken(token);
  if (!payload) {
    return NextResponse.json(
      { code: "auth", message: "Unauthorized", retryable: false },
      { status: 401 }
    );
  }

  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    return NextResponse.json(buildAccountSnapshot({ user: null }));
  }

  return NextResponse.json(
    buildAccountSnapshot({
      user,
      accessToken: token,
      expiresAt: new Date(payload.exp * 1000).toISOString()
    })
  );
}
