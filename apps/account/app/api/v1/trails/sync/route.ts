import { NextResponse } from "next/server";
import { getBearerToken } from "@/src/server/auth-headers";
import { internalApiFetch } from "@/src/server/internal-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = getBearerToken(request.headers);
  if (!token) {
    return NextResponse.json(
      { code: "auth", message: "Unauthorized", retryable: false },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { code: "validation", message: "Invalid request body", retryable: false },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await internalApiFetch("/api/v1/trails/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
