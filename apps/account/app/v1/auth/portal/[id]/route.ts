import { NextResponse } from "next/server";
import { db } from "@trail/db";
import { buildAccountSnapshot } from "@/src/server/account-snapshot";
import { createExtensionAccessToken } from "@/src/server/extension-auth";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ status: "expired" });
  }

  const record = await db.extensionLoginCode.findUnique({ where: { code: sessionId } });
  if (!record) {
    return NextResponse.json({ status: "pending" });
  }

  const now = new Date();
  if (record.expiresAt < now) {
    return NextResponse.json({ status: "expired" });
  }

  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user) {
    return NextResponse.json({ status: "expired" });
  }

  const token = createExtensionAccessToken(user.id);
  await db.extensionLoginCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() }
  });

  return NextResponse.json({
    status: "approved",
    snapshot: buildAccountSnapshot({
      user,
      accessToken: token.token,
      expiresAt: token.expiresAt
    })
  });
}
