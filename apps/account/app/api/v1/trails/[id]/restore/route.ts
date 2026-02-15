import { getBearerToken } from "@/src/server/backend/auth/headers";
import { resolveUserId } from "@/src/server/backend/auth/resolve-user";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";
import { toTrailRecord } from "@/src/server/backend/trail-serializers";
import { db } from "@trail/db";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return jsonError("trail_not_found", "Trail not found.", { status: 404 });
  }

  const token = getBearerToken(request.headers);
  const userId = await resolveUserId(token);
  if (!userId) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const now = new Date();
  const updated = await db.$transaction(async (tx) => {
    const existing = await tx.trail.findFirst({
      where: { id, userId, deletedAt: { not: null } },
    });
    if (!existing) return null;
    return tx.trail.update({
      where: { id },
      data: { deletedAt: null, updatedAt: now },
    });
  });

  if (!updated) {
    return jsonError("trail_not_found", "Trail not found.", { status: 404 });
  }

  return jsonNoStore(
    toTrailRecord(updated as typeof updated & { payload: unknown }),
  );
}
