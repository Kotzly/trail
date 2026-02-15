import { getBearerToken } from "@/src/server/backend/auth/headers";
import { resolveUserId } from "@/src/server/backend/auth/resolve-user";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";
import {
  type ApiLabelSource,
  type DbLabelSource,
  toTrailRecord,
} from "@/src/server/backend/trail-serializers";
import { db } from "@trail/db";

export const runtime = "nodejs";

/* ------------------------------------------------------------------ */
/*  Helpers local to this route                                        */
/* ------------------------------------------------------------------ */

const API_TO_LABEL: Record<ApiLabelSource, DbLabelSource> = {
  user: "USER",
  auto: "AUTO",
  system: "SYSTEM",
};

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

/* ------------------------------------------------------------------ */
/*  GET /api/v1/trails/:id                                             */
/* ------------------------------------------------------------------ */

export async function GET(
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

  const trail = await db.trail.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!trail) {
    return jsonError("trail_not_found", "Trail not found.", { status: 404 });
  }

  return jsonNoStore(toTrailRecord(trail as typeof trail & { payload: unknown }));
}

/* ------------------------------------------------------------------ */
/*  PATCH /api/v1/trails/:id                                           */
/* ------------------------------------------------------------------ */

export async function PATCH(
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

  const body = await request.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label : undefined;
  const labelSource =
    body?.labelSource !== undefined ? toDbLabelSource(body.labelSource) : undefined;
  if (labelSource === null) {
    return jsonError("invalid_label_source", "Invalid labelSource.", {
      status: 400,
    });
  }
  const deletedAt = parseDeletedAt(body?.deletedAt);
  const payload = body?.payload !== undefined ? body.payload : undefined;
  const nodeCount =
    typeof body?.nodeCount === "number" && Number.isInteger(body.nodeCount) && body.nodeCount >= 0
      ? body.nodeCount
      : undefined;
  const rootUrl =
    typeof body?.rootUrl === "string" ? body.rootUrl : body?.rootUrl === null ? null : undefined;
  const rootTitle =
    typeof body?.rootTitle === "string" ? body.rootTitle : body?.rootTitle === null ? null : undefined;
  const rootFavicon =
    typeof body?.rootFavicon === "string" ? body.rootFavicon : body?.rootFavicon === null ? null : undefined;
  const savedAtRaw =
    typeof body?.savedAt === "string" ? new Date(body.savedAt) : undefined;
  const savedAt =
    savedAtRaw && !Number.isNaN(savedAtRaw.getTime()) ? savedAtRaw : undefined;

  const hasMetaUpdate = label !== undefined || labelSource !== undefined || deletedAt !== undefined;
  const hasPayloadUpdate =
    payload !== undefined ||
    nodeCount !== undefined ||
    rootUrl !== undefined ||
    rootTitle !== undefined ||
    rootFavicon !== undefined ||
    savedAt !== undefined;

  if (!hasMetaUpdate && !hasPayloadUpdate) {
    return jsonError("invalid_payload", "Invalid update payload.", {
      status: 400,
    });
  }

  const now = new Date();
  const data: Record<string, unknown> = {};
  if (label !== undefined) {
    data.label = label;
    data.labelUpdatedAt = now;
  }
  if (labelSource !== undefined) {
    data.labelSource = labelSource;
    data.labelUpdatedAt = now;
  }
  if (deletedAt !== undefined) {
    data.deletedAt = deletedAt;
  }
  if (payload !== undefined) {
    data.payload = payload;
  }
  if (nodeCount !== undefined) {
    data.nodeCount = nodeCount;
  }
  if (rootUrl !== undefined) {
    data.rootUrl = rootUrl;
  }
  if (rootTitle !== undefined) {
    data.rootTitle = rootTitle;
  }
  if (rootFavicon !== undefined) {
    data.rootFavicon = rootFavicon;
  }
  if (savedAt !== undefined) {
    data.savedAt = savedAt;
  }
  data.updatedAt = now;

  const updated = await db.$transaction(async (tx) => {
    const existing = await tx.trail.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return tx.trail.update({ where: { id }, data });
  });

  if (!updated) {
    return jsonError("trail_not_found", "Trail not found.", { status: 404 });
  }

  return jsonNoStore(
    toTrailRecord(updated as typeof updated & { payload: unknown }),
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
  const userId = await resolveUserId(token);
  if (!userId) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const now = new Date();
  const updated = await db.$transaction(async (tx) => {
    const existing = await tx.trail.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return tx.trail.update({
      where: { id },
      data: { deletedAt: now, updatedAt: now },
    });
  });

  if (!updated) {
    return jsonError("trail_not_found", "Trail not found.", { status: 404 });
  }

  return jsonNoStore(
    toTrailRecord(updated as typeof updated & { payload: unknown }),
  );
}
