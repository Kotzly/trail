import { getBearerToken } from "@/src/server/auth/headers";
import { verifyUserToken } from "@/src/server/auth/user-auth";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { ensureUser } from "@/src/server/user";
import { db } from "@trail/db";

export const runtime = "nodejs";

type ApiLabelSource = "user" | "auto" | "system";

type DbLabelSource = "USER" | "AUTO" | "SYSTEM";

const LABEL_TO_API: Record<DbLabelSource, ApiLabelSource> = {
  USER: "user",
  AUTO: "auto",
  SYSTEM: "system",
};

const API_TO_LABEL: Record<ApiLabelSource, DbLabelSource> = {
  user: "USER",
  auto: "AUTO",
  system: "SYSTEM",
};

function toApiLabelSource(value: DbLabelSource): ApiLabelSource {
  return LABEL_TO_API[value] ?? "user";
}

function toDbLabelSource(value: unknown): DbLabelSource | null {
  if (typeof value !== "string") return null;
  const lowered = value.trim().toLowerCase() as ApiLabelSource;
  return API_TO_LABEL[lowered] ?? null;
}

function parseDeletedAt(value: unknown): Date | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
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

export async function PATCH(
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

  const body = await request.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label : undefined;
  const labelSource = toDbLabelSource(body?.labelSource);
  const deletedAt = parseDeletedAt(body?.deletedAt);

  if (!label && !labelSource && deletedAt === undefined) {
    return jsonError("invalid_payload", "Invalid update payload.", {
      status: 400,
    });
  }

  const existing = await db.trail.findFirst({ where: { id, userId: user.id } });
  if (!existing) {
    return jsonError("trail_not_found", "Trail not found.", { status: 404 });
  }

  const now = new Date();
  const data: Record<string, unknown> = {};
  if (label !== undefined) {
    data.label = label;
    data.labelUpdatedAt = now;
  }
  if (labelSource) {
    data.labelSource = labelSource;
    data.labelUpdatedAt = now;
  }
  if (deletedAt !== undefined) {
    data.deletedAt = deletedAt;
  }
  data.updatedAt = now;

  const updated = await db.trail.update({
    where: { id },
    data,
  });

  return jsonNoStore(
    toTrailRecord(updated as typeof existing & { payload: unknown }),
  );
}

export async function DELETE(
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
    data: { deletedAt: now, updatedAt: now },
  });

  return jsonNoStore(
    toTrailRecord(updated as typeof existing & { payload: unknown }),
  );
}
