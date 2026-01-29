import { NextResponse } from "next/server";
import { db } from "@trail/db";
import { requireInternalKey } from "@/src/server/internal-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = requireInternalKey(request.headers);
  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const code = body?.code as string | undefined;

  if (!code) {
    return NextResponse.json({ exists: false }, { status: 400 });
  }

  const record = await db.extensionLoginCode.findUnique({ where: { code } });
  return NextResponse.json({ exists: Boolean(record) });
}
