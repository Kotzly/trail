import { NextResponse } from "next/server";
import { getBearerToken } from "@/src/server/auth-headers";
import { verifyExtensionAccessToken } from "@/src/server/extension-auth";
import { internalApiFetch } from "@/src/server/internal-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = getBearerToken(request.headers);
  if (!token || !verifyExtensionAccessToken(token)) {
    return NextResponse.json(
      { code: "auth", message: "Unauthorized", retryable: false },
      { status: 401 },
    );
  }

  let upstream: Response;
  try {
    upstream = await internalApiFetch("/api/v1/subscription", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    return NextResponse.json(
      { code: "network", message: "Upstream unavailable", retryable: true },
      { status: 503 },
    );
  }

  const text = await upstream.text();
  const contentType = upstream.headers.get("content-type") ?? "application/json";

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
    },
  });
}
