import { db } from "@trail/db";
import { requireInternalKey } from "@/src/server/internal-auth";
import { jsonNoStore } from "@/src/server/response";
import { createExtensionToken } from "@/src/server/auth/extension-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = requireInternalKey(request.headers);
  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const code = body?.code as string | undefined;

  if (!code) {
    return jsonNoStore({ error: "code_required" }, { status: 400 });
  }

  const record = await db.extensionLoginCode.findUnique({
    where: { code },
    select: {
      id: true,
      expiresAt: true,
      usedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!record) {
    return jsonNoStore({ error: "invalid_code" }, { status: 404 });
  }

  if (!record.user) {
    return jsonNoStore({ error: "invalid_code" }, { status: 404 });
  }

  const now = new Date();
  if (record.usedAt || record.expiresAt < now) {
    return jsonNoStore({ error: "expired_code" }, { status: 410 });
  }

  await db.extensionLoginCode.update({
    where: { id: record.id },
    data: { usedAt: now },
  });

  const token = createExtensionToken(record.user.id);

  return jsonNoStore({
    user: {
      id: record.user.id,
      email: record.user.email,
      name: record.user.name,
    },
    token: token.token,
    expiresAt: token.expiresAt,
  });
}
