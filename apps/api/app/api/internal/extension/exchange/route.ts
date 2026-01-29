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
    return NextResponse.json({ error: "code_required" }, { status: 400 });
  }

  const record = await db.extensionLoginCode.findUnique({
    where: { code },
    include: { user: true }
  });

  if (!record) {
    return NextResponse.json({ error: "invalid_code" }, { status: 404 });
  }

  if (record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "expired_code" }, { status: 410 });
  }

  await db.extensionLoginCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() }
  });

  return NextResponse.json({
    user: {
      id: record.user.id,
      email: record.user.email,
      name: record.user.name
    },
    message: "Exchange stub. Token issuance will be added with extension API."
  });
}
