import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";
import { syncTrailsIndex } from "@/src/server/backend/trails-sync";
import { getExtensionConfig } from "@/src/server/backend/extension-config";
import { getFeatureAccessForUser } from "@/src/server/backend/subscription-access";
import {
  toApiLabelSource,
  type DbLabelSource,
} from "@/src/server/backend/trail-serializers";

export const runtime = "nodejs";

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * POST /api/v1/trails/sync
 *
 * Lightweight index sync: accepts {deviceId, clientSyncAt}, returns
 * metadata-only updates (no payload). The client uses separate PUT/GET/DELETE
 * endpoints for per-tree operations.
 */
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

  let result: Awaited<ReturnType<typeof syncTrailsIndex>>;
  try {
    result = await syncTrailsIndex({
      userId: extension.sub,
      deviceId,
      clientSyncAt,
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

  return jsonNoStore({
    serverSyncAt: result.serverSyncAt.toISOString(),
    updates: result.updates.map((trail) => ({
      id: trail.id,
      deviceId: trail.deviceId,
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
      deletedAt: trail.deletedAt ? trail.deletedAt.toISOString() : null,
    })),
  });
}
