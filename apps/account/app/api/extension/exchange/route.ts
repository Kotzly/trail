import { NextResponse } from "next/server";
import { internalApiFetch } from "@/src/server/internal-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = body?.code as string | undefined;

  if (!code) {
    return NextResponse.json({ error: "code_required" }, { status: 400 });
  }

  try {
    const response = await internalApiFetch(
      "/api/internal/extension/exchange",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      },
    );

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
