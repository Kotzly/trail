import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { resolveUserId } from "@/src/server/backend/auth/resolve-user";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";
import {
  type ApiLabelSource,
  type DbLabelSource,
  toTrailRecord,
} from "@/src/server/backend/trail-serializers";
import { isJsonValue } from "@/src/server/backend/json";
import { upsertTrail } from "@/src/server/backend/trails-sync";
import type { TrailLabelSource } from "@/src/server/backend/trails-sync";
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
/*  PUT /api/v1/trails/:id — single-tree upsert with LWW merge        */
/* ------------------------------------------------------------------ */

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

const API_TO_DB_LABEL: Record<ApiLabelSource, DbLabelSource> = {
  user: "USER",
  auto: "AUTO",
  system: "SYSTEM",
};

function toDbLabelSourceStrict(value: unknown): DbLabelSource | null {
  if (typeof value !== "string") return null;
  const lowered = value.trim().toLowerCase() as ApiLabelSource;
  return API_TO_DB_LABEL[lowered] ?? null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return jsonError("trail_not_found", "Trail not found.", { status: 404 });
  }

  const token = getBearerToken(request.headers);
  const extension = token ? await verifyExtensionToken(token) : null;
  if (!extension?.sub) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("invalid_payload", "Invalid payload.", { status: 400 });
  }

  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  if (!deviceId) {
    return jsonError("device_id_required", "Device id is required.", { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label : "";
  const labelSource = toDbLabelSourceStrict(body.labelSource);
  const labelUpdatedAt = parseDate(body.labelUpdatedAt);
  const createdAt = parseDate(body.createdAt);
  const updatedAt = parseDate(body.updatedAt);
  const savedAt = parseDate(body.savedAt);
  const nodeCount = typeof body.nodeCount === "number" && Number.isInteger(body.nodeCount) && body.nodeCount >= 0
    ? body.nodeCount
    : null;
  const payload = body.payload ?? null;

  if (
    !label ||
    !labelSource ||
    !labelUpdatedAt ||
    !createdAt ||
    !updatedAt ||
    !savedAt ||
    nodeCount === null ||
    !isJsonValue(payload)
  ) {
    return jsonError("invalid_payload", "Missing required fields.", { status: 400 });
  }

  let deletedAtRaw: Date | null;
  if (body.deletedAt === null || body.deletedAt === undefined) {
    deletedAtRaw = null;
  } else {
    const parsed = parseDate(body.deletedAt);
    if (!parsed) {
      return jsonError("invalid_payload", "Invalid deletedAt value.", { status: 400 });
    }
    deletedAtRaw = parsed;
  }

  try {
    const result = await upsertTrail({
      userId: extension.sub,
      deviceId,
      trail: {
        id,
        deviceId: typeof body.trailDeviceId === "string" ? body.trailDeviceId : null,
        label,
        labelSource: labelSource as TrailLabelSource,
        labelUpdatedAt,
        createdAt,
        updatedAt,
        savedAt,
        nodeCount,
        rootUrl: typeof body.rootUrl === "string" ? body.rootUrl : null,
        rootTitle: typeof body.rootTitle === "string" ? body.rootTitle : null,
        rootFavicon: typeof body.rootFavicon === "string" ? body.rootFavicon : null,
        payload,
        deletedAt: deletedAtRaw,
      },
    });

    return jsonNoStore({
      updatedAt: result.updatedAt.toISOString(),
      applied: result.applied,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "user_not_found") {
      return jsonError("unauthorized", "Unauthorized.", {
        status: 401,
        retryable: false,
        details: "reason=user_not_found",
      });
    }

    if (message === "device_id_required") {
      return jsonError("device_id_required", "Device id is required.", {
        status: 400,
      });
    }

    return jsonError("internal_error", "Internal error.", {
      status: 500,
      retryable: true,
    });
  }
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
