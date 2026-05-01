import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { jsonFail, jsonOk } from "@/src/server/backend/error-response";
import { syncTrailsIndex } from "@/src/server/backend/trails-sync";
import { getExtensionConfig } from "@/src/server/backend/extension-config";
import { getFeatureAccessForUser } from "@/src/server/backend/subscription-access";
import {
  toApiLabelSource,
  type DbLabelSource,
} from "@/src/server/backend/trail-serializers";
import { rateLimit } from "@/src/server/api/rate-limit";
import { optionsResponse } from "@/src/server/api/cors";
import { trailsSyncBodySchema } from "@/src/server/api/schemas";
import { parseBody } from "@/src/server/api/validate";

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
export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(ip, "sync");
  if (!rl.ok) {
    return jsonFail("RATE_LIMITED", "Too many requests", { status: 429 });
  }

  const token = getBearerToken(request.headers);
  const extension = token ? await verifyExtensionToken(token) : null;
  if (!extension?.sub) {
    return jsonFail("unauthorized", "Unauthorized.", { status: 401 });
  }

  const { config } = getExtensionConfig();
  const access = await getFeatureAccessForUser({
    userId: extension.sub,
    config,
    featureKey: "trailsSync",
    fallbackMinTier: "free",
  });
  if (!access.allowed) {
    return jsonFail(
      "feature_locked",
      `Trails sync requires ${access.requiredTier} plan.`,
      {
        status: 402,
        retryable: false,
        details: `feature=trailsSync requiredTier=${access.requiredTier} currentTier=${access.currentTier}`,
      },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = parseBody(trailsSyncBodySchema, rawBody);
  if (!parsed.ok) {
    return jsonFail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input", { status: 400 });
  }

  const deviceId = parsed.data.deviceId;
  const clientSyncAt = parseDate(parsed.data.clientSyncAt);

  if (!clientSyncAt) {
    return jsonFail("client_sync_at_required", "clientSyncAt is required.", {
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
      return jsonFail("unauthorized", "Unauthorized.", {
        status: 401,
        retryable: false,
        details: "reason=user_not_found",
      });
    }

    if (message === "device_id_required") {
      return jsonFail("device_id_required", "Device id is required.", {
        status: 400,
      });
    }

    return jsonFail("internal_error", "Internal error.", {
      status: 500,
      retryable: true,
    });
  }

  return jsonOk({
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
