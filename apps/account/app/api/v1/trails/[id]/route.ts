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

type DbTrailRow = {
  id: string;
  user_id: string;
  device_id: string;
  label: string;
  label_source: string;
  label_updated_at: string;
  created_at: string;
  updated_at: string;
  saved_at: string;
  node_count: number;
  root_url: string | null;
  root_title: string | null;
  root_favicon: string | null;
  deleted_at: string | null;
  payload: unknown;
};

function rowToTrailRecord(row: DbTrailRow) {
  return toTrailRecord({
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    label: row.label,
    labelSource: row.label_source as DbLabelSource,
    labelUpdatedAt: new Date(row.label_updated_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    savedAt: new Date(row.saved_at),
    nodeCount: row.node_count,
    rootUrl: row.root_url,
    rootTitle: row.root_title,
    rootFavicon: row.root_favicon,
    payload: row.payload,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  });
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

  const result = await db
    .from("trails")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (result.error) {
    return jsonError("internal_error", "Internal error.", { status: 500 });
  }
  if (!result.data) {
    return jsonError("trail_not_found", "Trail not found.", { status: 404 });
  }

  return jsonNoStore(rowToTrailRecord(result.data as DbTrailRow));
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
  const data: Record<string, unknown> = { updated_at: now.toISOString() };
  if (label !== undefined) {
    data.label = label;
    data.label_updated_at = now.toISOString();
  }
  if (labelSource !== undefined) {
    data.label_source = labelSource;
    data.label_updated_at = now.toISOString();
  }
  if (deletedAt !== undefined) {
    data.deleted_at = deletedAt ? deletedAt.toISOString() : null;
  }
  if (payload !== undefined) {
    data.payload = payload;
  }
  if (nodeCount !== undefined) {
    data.node_count = nodeCount;
  }
  if (rootUrl !== undefined) {
    data.root_url = rootUrl;
  }
  if (rootTitle !== undefined) {
    data.root_title = rootTitle;
  }
  if (rootFavicon !== undefined) {
    data.root_favicon = rootFavicon;
  }
  if (savedAt !== undefined) {
    data.saved_at = savedAt.toISOString();
  }

  const result = await db
    .from("trails")
    .update(data)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (result.error) {
    if (result.error.code === "PGRST116") {
      return jsonError("trail_not_found", "Trail not found.", { status: 404 });
    }
    return jsonError("internal_error", "Internal error.", { status: 500 });
  }
  if (!result.data) {
    return jsonError("trail_not_found", "Trail not found.", { status: 404 });
  }

  return jsonNoStore(rowToTrailRecord(result.data as DbTrailRow));
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

  const result = await db
    .from("trails")
    .update({ deleted_at: now.toISOString(), updated_at: now.toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (result.error) {
    if (result.error.code === "PGRST116") {
      return jsonError("trail_not_found", "Trail not found.", { status: 404 });
    }
    return jsonError("internal_error", "Internal error.", { status: 500 });
  }
  if (!result.data) {
    return jsonError("trail_not_found", "Trail not found.", { status: 404 });
  }

  return jsonNoStore(rowToTrailRecord(result.data as DbTrailRow));
}
