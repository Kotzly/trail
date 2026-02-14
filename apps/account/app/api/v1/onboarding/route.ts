import { NextResponse } from "next/server";
import { getBearerToken } from "@/src/server/auth-headers";
import { internalApiFetch } from "@/src/server/internal-api";

export const runtime = "nodejs";

/**
 * Proxy for extension-authenticated onboarding endpoints.
 * Forwards GET and POST to the API app's /api/v1/onboarding.
 */

async function proxy(request: Request, method: "GET" | "POST") {
  const token = getBearerToken(request.headers);
  if (!token) {
    return NextResponse.json(
      { code: "auth", message: "Unauthorized", retryable: false },
      { status: 401 },
    );
  }

  try {
    const init: RequestInit = {
      method,
      headers: { Authorization: `Bearer ${token}` },
    };

    if (method === "POST") {
      const body = await request.text();
      if (body) {
        (init.headers as Record<string, string>)["Content-Type"] =
          "application/json";
        init.body = body;
      }
    }

    const upstream = await internalApiFetch("/api/v1/onboarding", init);
    const payload = await upstream.json().catch(() => null);

    return NextResponse.json(payload, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { code: "unknown", message: "Internal error", retryable: true },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return proxy(request, "GET");
}

export async function POST(request: Request) {
  return proxy(request, "POST");
}
