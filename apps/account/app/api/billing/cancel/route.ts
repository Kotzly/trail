import { NextResponse } from "next/server";
import { getAuthTokenFromCookies } from "@/src/lib/auth";
import { POST as cancelV1 } from "@/app/api/v1/subscription/cancel/route";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

  const upstream = await cancelV1(
    new Request(new URL("/api/v1/subscription/cancel", request.url), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );

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
