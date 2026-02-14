import { NextResponse } from "next/server";
import { getAuthSession } from "@/src/lib/auth";
import { internalApiFetch } from "@/src/server/internal-api";

export const runtime = "nodejs";

/**
 * Dev-only: reset onboarding for the current user.
 * DELETE /api/onboarding/reset
 */
export async function DELETE() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { code: "forbidden", message: "Not available in production." },
      { status: 403 },
    );
  }

  const session = await getAuthSession();
  if (!session?.user.id) {
    return NextResponse.json(
      { code: "auth", message: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const upstream = await internalApiFetch(
      `/api/internal/users/${encodeURIComponent(session.user.id)}/onboarding`,
      { method: "DELETE" },
    );

    const payload = await upstream.json().catch(() => null);
    return NextResponse.json(payload, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { code: "unknown", message: "Internal error." },
      { status: 500 },
    );
  }
}
