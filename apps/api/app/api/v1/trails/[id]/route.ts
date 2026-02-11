import { getBearerToken } from "@/src/server/auth/headers";
import { verifyExtensionToken } from "@/src/server/auth/extension-auth";
import { verifyUserToken } from "@/src/server/auth/user-auth";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { ensureUser, getUserById } from "@/src/server/user";
import { db } from "@trail/db";

export const runtime = "nodejs";

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Auth: accept both user token (Better Auth) and extension token     */
/* ------------------------------------------------------------------ */

async function resolveUserId(
  token: string | null,
): Promise<string | null> {
  if (!token) return null;

  // 1. Try extension token (HMAC-signed JWT)
  const extension = verifyExtensionToken(token);
  if (extension?.sub) {
    const user = await getUserById(extension.sub);
    return user?.id ?? null;
  }

  // 2. Fall back to user token (Better Auth JWKS)
  const authUser = await verifyUserToken(token);
  if (!authUser) return null;

  const user = await ensureUser(authUser);
  return user?.id ?? null;
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
  const labelSource = toDbLabelSource(body?.labelSource);
  const deletedAt = parseDeletedAt(body?.deletedAt);
  const payload = body?.payload !== undefined ? body.payload : undefined;
  const nodeCount =
    typeof body?.nodeCount === "number" ? body.nodeCount : undefined;
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

  const hasMetaUpdate = label || labelSource || deletedAt !== undefined;
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

  const existing = await db.trail.findFirst({ where: { id, userId } });
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
  const userId = await resolveUserId(token);
  if (!userId) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const existing = await db.trail.findFirst({ where: { id, userId } });
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
