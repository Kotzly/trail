import { NextResponse } from "next/server";
import { verifyExtensionAccessToken } from "@/src/server/extension-auth";
import { internalApiFetch } from "@/src/server/internal-api";

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
      { status: 401 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "application/json";
  const body = await request.text().catch(() => "");

  let upstream: Response;
  try {
    upstream = await internalApiFetch("/v1/billing/portal", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: body || undefined,
    });
  } catch {
    return NextResponse.json(
      { code: "network", message: "Upstream unavailable", retryable: true },
      { status: 503 },
    );
  }

  const text = await upstream.text();
  const upstreamContentType = upstream.headers.get("content-type") ?? "application/json";

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type": upstreamContentType,
      "cache-control": "no-store",
    },
  });
}
