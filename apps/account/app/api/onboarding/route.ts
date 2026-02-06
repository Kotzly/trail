import { NextResponse } from "next/server";
import { getAuthSession } from "@/src/lib/auth";
import { internalApiJson } from "@/src/server/internal-api";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ seen: false }, { status: 401 });
}

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user.id) {
    return unauthorized();
  }

  try {
    const payload = await internalApiJson<{ seen: boolean }>(
      `/api/internal/users/${encodeURIComponent(session.user.id)}/onboarding`,
      { method: "GET" },
    );

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ seen: false }, { status: 500 });
  }
}

export async function POST() {
  const session = await getAuthSession();
  if (!session?.user.id) {
    return unauthorized();
  }

  try {
    const payload = await internalApiJson<{ seen: boolean }>(
      `/api/internal/users/${encodeURIComponent(session.user.id)}/onboarding`,
      { method: "POST" },
    );

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ seen: false }, { status: 500 });
  }
}
