import { NextResponse } from "next/server";
import { getAuthSession } from "@/src/lib/auth";
import { resetUserOnboarding } from "@/src/server/backend/user";

export const runtime = "nodejs";

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

  const reset = await resetUserOnboarding(session.user.id).catch(() => false);
  if (!reset) {
    return NextResponse.json(
      { code: "not_found", message: "User not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
