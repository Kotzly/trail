import { NextResponse } from "next/server";
import { buildAccountSnapshot } from "@/src/server/account-snapshot";
import { verifyExtensionAccessToken } from "@/src/server/extension-auth";
import { getExtensionConfig } from "@/src/server/extension-config";
import { internalApiJson } from "@/src/server/internal-api";

export const runtime = "nodejs";

function getBearerToken(headers: Headers): string | null {
  const auth = headers.get("authorization") ?? headers.get("Authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export async function GET(request: Request) {
  const config = await getExtensionConfig();
  const token = getBearerToken(request.headers);
  if (!token) {
    return NextResponse.json(buildAccountSnapshot({ user: null, config }));
  }

  const payload = verifyExtensionAccessToken(token);
  if (!payload) {
    return NextResponse.json(
      { code: "auth", message: "Unauthorized", retryable: false },
      { status: 401 },
    );
  }

  try {
    const { user } = await internalApiJson<{
      user: {
        id: string;
        email: string | null;
        name: string | null;
        imageUrl: string | null;
        createdAt: string;
      } | null;
    }>(`/api/internal/users/${encodeURIComponent(payload.sub)}`, {
      method: "GET",
    });

    if (!user) {
      return NextResponse.json(buildAccountSnapshot({ user: null, config }));
    }

    return NextResponse.json(
      buildAccountSnapshot({
        user: {
          ...user,
          createdAt: new Date(user.createdAt),
        },
        accessToken: token,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        config,
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
