import { revokeOAuthRefreshToken } from "@/src/server/backend/oauth";

export const runtime = "nodejs";

function readRefreshToken(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const value = (body as Record<string, unknown>).refresh_token;
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const refreshToken = readRefreshToken(body);
  if (refreshToken) {
    await revokeOAuthRefreshToken(refreshToken);
  }
  return new Response(null, { status: 204 });
}

