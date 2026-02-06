import { NextResponse } from "next/server";
import { internalApiFetch } from "@/src/server/internal-api";

export const runtime = "nodejs";

export async function GET() {
  let upstream: Response;
  try {
    upstream = await internalApiFetch("/v1/plans", { method: "GET" });
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
