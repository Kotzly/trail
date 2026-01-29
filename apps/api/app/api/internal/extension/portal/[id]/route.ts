import { NextResponse } from "next/server";
import { db } from "@trail/db";
import { requireInternalKey } from "@/src/server/internal-auth";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireInternalKey(request.headers);
  if (unauthorized) {
    return unauthorized;
  }

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

  await db.extensionLoginCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() }
  });

  return NextResponse.json({
    status: "approved",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      imageUrl: user.imageUrl,
      createdAt: user.createdAt.toISOString()
    }
  });
}
