import { getBearerToken } from "@/src/server/auth/headers";
import { verifyExtensionToken } from "@/src/server/auth/extension-auth";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { syncTrails } from "@/src/server/trails-sync";

export const runtime = "nodejs";

type ApiLabelSource = "user" | "auto" | "system";

type DbLabelSource = "USER" | "AUTO" | "SYSTEM";

const API_TO_LABEL: Record<ApiLabelSource, DbLabelSource> = {
  user: "USER",
  auto: "AUTO",
  system: "SYSTEM"
};

const LABEL_TO_API: Record<DbLabelSource, ApiLabelSource> = {
  USER: "user",
  AUTO: "auto",
  SYSTEM: "system"
};

function toDbLabelSource(value: unknown): DbLabelSource | null {
  if (typeof value !== "string") return null;
  const lowered = value.trim().toLowerCase() as ApiLabelSource;
  return API_TO_LABEL[lowered] ?? null;
}

function toApiLabelSource(value: DbLabelSource): ApiLabelSource {
  return LABEL_TO_API[value] ?? "user";
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseNullableDate(value: unknown): Date | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  return parseDate(value);
}

export async function POST(request: Request) {
  const token = getBearerToken(request.headers);
  const extension = token ? verifyExtensionToken(token) : null;
  if (!extension?.sub) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
  const clientSyncAt = parseDate(body?.clientSyncAt);
  const trails = Array.isArray(body?.trails) ? body.trails : null;

  if (!deviceId) {
    return jsonError("device_id_required", "Device id is required.", { status: 400 });
  }

  if (!clientSyncAt) {
    return jsonError("client_sync_at_required", "clientSyncAt is required.", { status: 400 });
  }

  if (!trails) {
    return jsonError("trails_required", "Trails payload is required.", { status: 400 });
  }

  const normalized = [] as Array<{
    id: string;
    deviceId?: string | null;
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
  }>;

  for (const trail of trails) {
    if (!trail || typeof trail !== "object") {
      return jsonError("invalid_trail", "Invalid trail payload.", { status: 400 });
    }

    const id = typeof trail.id === "string" ? trail.id : "";
    const label = typeof trail.label === "string" ? trail.label : "";
    const labelSource = toDbLabelSource(trail.labelSource);
    const labelUpdatedAt = parseDate(trail.labelUpdatedAt);
    const createdAt = parseDate(trail.createdAt);
    const updatedAt = parseDate(trail.updatedAt);
    const savedAt = parseDate(trail.savedAt);
    const nodeCount = typeof trail.nodeCount === "number" ? trail.nodeCount : null;

    if (!id || !label || !labelSource || !labelUpdatedAt || !createdAt || !updatedAt || !savedAt || nodeCount === null) {
      return jsonError("invalid_trail", "Invalid trail payload.", { status: 400 });
    }

    const deletedAt = parseNullableDate(trail.deletedAt);
    if (deletedAt === undefined) {
      return jsonError("invalid_trail", "Invalid trail payload.", { status: 400 });
    }

    normalized.push({
      id,
      deviceId: typeof trail.deviceId === "string" ? trail.deviceId : null,
      label,
      labelSource,
      labelUpdatedAt,
      createdAt,
      updatedAt,
      savedAt,
      nodeCount,
      rootUrl: typeof trail.rootUrl === "string" ? trail.rootUrl : null,
      rootTitle: typeof trail.rootTitle === "string" ? trail.rootTitle : null,
      rootFavicon: typeof trail.rootFavicon === "string" ? trail.rootFavicon : null,
      payload: trail.payload ?? null,
      deletedAt
    });
  }

  const result = await syncTrails({
    userId: extension.sub,
    deviceId,
    clientSyncAt,
    trails: normalized
  });

  return jsonNoStore({
    serverSyncAt: result.serverSyncAt.toISOString(),
    updates: result.updates.map((trail) => ({
      id: trail.id,
      deviceId: trail.deviceId ?? deviceId,
      label: trail.label,
      labelSource: toApiLabelSource(trail.labelSource as DbLabelSource),
      labelUpdatedAt: trail.labelUpdatedAt.toISOString(),
      createdAt: trail.createdAt.toISOString(),
      updatedAt: trail.updatedAt.toISOString(),
      savedAt: trail.savedAt.toISOString(),
      nodeCount: trail.nodeCount,
      rootUrl: trail.rootUrl ?? null,
      rootTitle: trail.rootTitle ?? null,
      rootFavicon: trail.rootFavicon ?? null,
      payload: trail.payload,
      deletedAt: trail.deletedAt ? trail.deletedAt.toISOString() : null
    }))
  });
}
