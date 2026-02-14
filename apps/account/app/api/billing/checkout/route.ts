import { NextResponse } from "next/server";
import { getAuthTokenFromCookies } from "@/src/lib/auth";
import { POST as checkoutV1 } from "@/app/api/v1/subscription/checkout/route";

export const runtime = "nodejs";

type CheckoutInterval = "month" | "year";

function isInterval(value: unknown): value is CheckoutInterval {
  return value === "month" || value === "year";
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

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

  const body = await request.json().catch(() => null);
  if (
    typeof body?.planId !== "string" ||
    !body.planId.trim() ||
    !isInterval(body.interval) ||
    !isOptionalString(body.successUrl) ||
    !isOptionalString(body.cancelUrl)
  ) {
    return NextResponse.json(
      { code: "validation", message: "Invalid checkout input", retryable: false },
      { status: 400 },
    );
  }

  const upstream = await checkoutV1(
    new Request(new URL("/api/v1/subscription/checkout", request.url), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        planId: body.planId,
        interval: body.interval,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
      }),
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
