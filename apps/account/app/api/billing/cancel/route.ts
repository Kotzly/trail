import { NextResponse } from "next/server";
import { getAuthTokenFromCookies } from "@/src/lib/auth";
import { internalApiFetch } from "@/src/server/internal-api";

export const runtime = "nodejs";

export async function POST() {
  const token = await getAuthTokenFromCookies();
  if (!token) {
    return NextResponse.json(
      {
        code: "auth",
        message: "Unauthorized",
        retryable: false,
        redirectUrl: "/auth/login?next=/billing",
      },
      { status: 401 },
    );
  }

  let upstream: Response;
  try {
    upstream = await internalApiFetch("/api/v1/subscription/cancel", {
      method: "POST",
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

  if (upstream.status === 401) {
    return NextResponse.json(
      {
        code: "auth",
        message: "Session expired. Please refresh.",
        retryable: false,
        redirectUrl: "/auth/refresh?next=/billing",
      },
      { status: 401 },
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

