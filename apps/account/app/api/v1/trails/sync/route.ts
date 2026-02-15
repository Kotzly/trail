import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";
import { isJsonValue, type JsonValue } from "@/src/server/backend/json";
import { syncTrails } from "@/src/server/backend/trails-sync";
import { getExtensionConfig } from "@/src/server/backend/extension-config";
import { getFeatureAccessForUser } from "@/src/server/backend/subscription-access";

export const runtime = "nodejs";

type ApiLabelSource = "user" | "auto" | "system";

type DbLabelSource = "USER" | "AUTO" | "SYSTEM";

const API_TO_LABEL: Record<ApiLabelSource, DbLabelSource> = {
  user: "USER",
  auto: "AUTO",
  system: "SYSTEM",
};

const LABEL_TO_API: Record<DbLabelSource, ApiLabelSource> = {
  USER: "user",
  AUTO: "auto",
  SYSTEM: "system",
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
  const extension = token ? await verifyExtensionToken(token) : null;
  if (!extension?.sub) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const { config } = getExtensionConfig();
  const access = await getFeatureAccessForUser({
    userId: extension.sub,
    config,
    featureKey: "trailsSync",
    fallbackMinTier: "free",
  });
  if (!access.allowed) {
    return jsonError(
      "feature_locked",
      `Trails sync requires ${access.requiredTier} plan.`,
      {
        status: 402,
        retryable: false,
        details: `feature=trailsSync requiredTier=${access.requiredTier} currentTier=${access.currentTier}`,
      },
    );
  }

  const body = await request.json().catch(() => null);
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";
  const clientSyncAt = parseDate(body?.clientSyncAt);
  const trails = Array.isArray(body?.trails) ? body.trails : null;

  if (!deviceId) {
    return jsonError("device_id_required", "Device id is required.", {
      status: 400,
    });
  }

  if (!clientSyncAt) {
    return jsonError("client_sync_at_required", "clientSyncAt is required.", {
      status: 400,
    });
  }

  if (!trails) {
    return jsonError("trails_required", "Trails payload is required.", {
      status: 400,
    });
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
    payload: JsonValue;
    deletedAt?: Date | null;
  }>;

  for (const trail of trails) {
    if (!trail || typeof trail !== "object") {
      return jsonError("invalid_trail", "Invalid trail payload.", {
        status: 400,
      });
    }

    const id = typeof trail.id === "string" ? trail.id : "";
    const label = typeof trail.label === "string" ? trail.label : "";
    const labelSource = toDbLabelSource(trail.labelSource);
    const labelUpdatedAt = parseDate(trail.labelUpdatedAt);
    const createdAt = parseDate(trail.createdAt);
    const updatedAt = parseDate(trail.updatedAt);
    const savedAt = parseDate(trail.savedAt);
    const nodeCount =
      typeof trail.nodeCount === "number" ? trail.nodeCount : null;

    if (
      !id ||
      !label ||
      !labelSource ||
      !labelUpdatedAt ||
      !createdAt ||
      !updatedAt ||
      !savedAt ||
      nodeCount === null
    ) {
      return jsonError("invalid_trail", "Invalid trail payload.", {
        status: 400,
      });
    }

    const deletedAt = parseNullableDate(trail.deletedAt);
    if (deletedAt === undefined) {
      return jsonError("invalid_trail", "Invalid trail payload.", {
        status: 400,
      });
    }

    const payload = trail.payload ?? null;
    if (!isJsonValue(payload)) {
      return jsonError("invalid_trail", "Invalid trail payload.", {
        status: 400,
      });
    }

    normalized.push({
      id,
      deviceId:
        typeof trail.deviceId === "string" ? trail.deviceId.trim() || null : null,
      label,
      labelSource,
      labelUpdatedAt,
      createdAt,
      updatedAt,
      savedAt,
      nodeCount,
      rootUrl: typeof trail.rootUrl === "string" ? trail.rootUrl : null,
      rootTitle: typeof trail.rootTitle === "string" ? trail.rootTitle : null,
      rootFavicon:
        typeof trail.rootFavicon === "string" ? trail.rootFavicon : null,
      payload,
      deletedAt,
    });
  }

  let result: Awaited<ReturnType<typeof syncTrails>>;
  try {
    result = await syncTrails({
      userId: extension.sub,
      deviceId,
      clientSyncAt,
      trails: normalized,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    // Token is valid but user no longer exists (e.g. local DB reset).
    if (message === "user_not_found") {
      return jsonError("unauthorized", "Unauthorized.", {
        status: 401,
        retryable: false,
        details: "reason=user_not_found",
      });
    }

    // Client tried to sync using a device id belonging to a different user.
    if (message.startsWith("device_conflict:")) {
      const deviceId = message.slice("device_conflict:".length);
      return jsonError("device_conflict", "Device belongs to another user.", {
        status: 409,
        retryable: false,
        details: `deviceId=${deviceId}`,
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
      deletedAt: trail.deletedAt ? trail.deletedAt.toISOString() : null,
    })),
  });
}
