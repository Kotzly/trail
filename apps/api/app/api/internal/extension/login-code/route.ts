import { NextResponse } from "next/server";
import { createExtensionLoginCode } from "@/src/server/extension-login";
import { requireInternalKey } from "@/src/server/internal-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = requireInternalKey(request.headers);
  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const userId = body?.userId as string | undefined;
  const preferredCode = body?.preferredCode as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "user_id_required" }, { status: 400 });
  }

  const code = await createExtensionLoginCode(userId, preferredCode);
  return NextResponse.json({ code });
}
