import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyUserToken } from "@/src/server/backend/auth/user-auth";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";
import { ensureUser } from "@/src/server/backend/user";
import { db } from "@trail/db";

export const runtime = "nodejs";

type ApiLabelSource = "user" | "auto" | "system";

type DbLabelSource = "USER" | "AUTO" | "SYSTEM";

const LABEL_TO_API: Record<DbLabelSource, ApiLabelSource> = {
  USER: "user",
  AUTO: "auto",
  SYSTEM: "system",
};

function toApiLabelSource(value: DbLabelSource): ApiLabelSource {
  return LABEL_TO_API[value] ?? "user";
}

function toTrailRecord(trail: {
  id: string;
  userId: string;
  deviceId: string;
  label: string;
  labelSource: DbLabelSource;
  labelUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  savedAt: Date;
  nodeCount: number;
  rootUrl?: string | null;
  rootTitle?: string | null;
  rootFavicon?: string | null;
  payload: unknown;
  deletedAt?: Date | null;
}) {
  return {
    id: trail.id,
    userId: trail.userId,
    deviceId: trail.deviceId,
    label: trail.label,
    labelSource: toApiLabelSource(trail.labelSource),
    labelUpdatedAt: trail.labelUpdatedAt.toISOString(),
    createdAt: trail.createdAt.toISOString(),
    updatedAt: trail.updatedAt.toISOString(),
    savedAt: trail.savedAt.toISOString(),
    nodeCount: trail.nodeCount,
    rootUrl: trail.rootUrl ?? null,
    rootTitle: trail.rootTitle ?? null,
    rootFavicon: trail.rootFavicon ?? null,
    payload: trail.payload,
    deletedAt: trail.deletedAt ? trail.deletedAt.toISOString() : null,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return jsonError("trail_not_found", "Trail not found.", { status: 404 });
  }

  const token = getBearerToken(request.headers);
  const authUser = await verifyUserToken(token);
  if (!authUser) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const user = await ensureUser(authUser);
  if (!user) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const existing = await db.trail.findFirst({ where: { id, userId: user.id } });
  if (!existing) {
    return jsonError("trail_not_found", "Trail not found.", { status: 404 });
  }

  const now = new Date();
  const updated = await db.trail.update({
    where: { id },
    data: { deletedAt: null, updatedAt: now },
  });

  return jsonNoStore(
    toTrailRecord(updated as typeof existing & { payload: unknown }),
  );
}
