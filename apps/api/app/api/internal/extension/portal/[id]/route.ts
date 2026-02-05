import { db } from "@trail/db";
import { requireInternalKey } from "@/src/server/internal-auth";
import { jsonNoStore } from "@/src/server/response";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = requireInternalKey(request.headers);
  if (unauthorized) {
    return unauthorized;
  }

  const { id: sessionId } = await params;
  if (!sessionId) {
    return jsonNoStore({ status: "expired" });
  }

  const record = await db.extensionLoginCode.findUnique({
    where: { code: sessionId },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          imageUrl: true,
          createdAt: true,
        },
      },
    },
  });
  if (!record) {
    return jsonNoStore({ status: "pending" });
  }

  const now = new Date();
  if (record.expiresAt < now) {
    return jsonNoStore({ status: "expired" });
  }

  const user = record.user;
  if (!user) {
    return jsonNoStore({ status: "expired" });
  }

  await db.extensionLoginCode.update({
    where: { id: record.id },
    data: { usedAt: now },
  });

  return jsonNoStore({
    status: "approved",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      imageUrl: user.imageUrl,
      createdAt: user.createdAt.toISOString(),
    },
  });
}
