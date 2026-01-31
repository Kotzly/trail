import { db } from "@trail/db";
import { requireInternalKey } from "@/src/server/internal-auth";
import { jsonNoStore } from "@/src/server/response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = requireInternalKey(request.headers);
  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const code = body?.code as string | undefined;

  if (!code) {
    return jsonNoStore({ exists: false }, { status: 400 });
  }

  const record = await db.extensionLoginCode.findUnique({
    where: { code },
    select: { id: true }
  });
  return jsonNoStore({ exists: Boolean(record) });
}
