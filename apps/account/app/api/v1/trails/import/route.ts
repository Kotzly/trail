import { getBearerToken } from "@/src/server/backend/auth/headers";
import { resolveUserId } from "@/src/server/backend/auth/resolve-user";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";
import { getAuthTokenFromCookies } from "@/src/lib/auth";
import { db } from "@trail/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

function importDeviceId(userId: string): string {
  return `import:${userId}`;
}
const EXPORT_SCHEMA = "trail.export.v1" as const;

type TrailLabelSource = "USER" | "AUTO" | "SYSTEM";

/**
 * POST /api/v1/trails/import
 *
 * Accepts a TrailExportBundle JSON body and creates a new Trail record.
 * Auth: Bearer token or cookie-based session.
 */
export async function POST(request: Request) {
  // Resolve authenticated user
  const bearerToken = getBearerToken(request.headers);
  const cookieToken = await getAuthTokenFromCookies();
  const userId = await resolveUserId(bearerToken ?? cookieToken);
  if (!userId) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_body", "Invalid JSON body.", { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return jsonError("invalid_body", "Body must be a JSON object.", { status: 400 });
  }

  const bundle = body as Record<string, unknown>;

  // Validate schema version
  if (bundle.schema !== EXPORT_SCHEMA) {
    return jsonError(
      "invalid_schema",
      `Expected schema "${EXPORT_SCHEMA}", got "${String(bundle.schema)}".`,
      { status: 400 },
    );
  }

  // Validate tree payload
  const tree = bundle.tree;
  if (!tree || typeof tree !== "object") {
    return jsonError("invalid_tree", "Missing or invalid tree payload.", { status: 400 });
  }

  const treeObj = tree as Record<string, unknown>;
  if (!("root" in treeObj) || !("nodeCount" in treeObj)) {
    return jsonError("invalid_tree", "Tree must have root and nodeCount fields.", { status: 400 });
  }

  const nodeCount = typeof treeObj.nodeCount === "number" ? treeObj.nodeCount : 0;

  // Extract source metadata
  const source = (bundle.source ?? {}) as Record<string, unknown>;
  const label = typeof source.treeLabel === "string" && source.treeLabel
    ? source.treeLabel
    : extractLabelFromTree(treeObj) || "Imported Trail";

  const labelSource: TrailLabelSource =
    typeof source.treeLabel === "string" && source.treeLabel ? "USER" : "AUTO";

  // Extract root node metadata
  const rootNode = treeObj.root as Record<string, unknown> | null;
  const rootData = rootNode?.data as Record<string, unknown> | null | undefined;
  const rootUrl = typeof rootData?.url === "string" ? rootData.url : null;
  const rootTitle = typeof rootData?.title === "string" ? rootData.title : null;
  const rootFavicon = typeof rootData?.favicon === "string" ? rootData.favicon : null;

  const now = new Date();
  const trailId = randomUUID();

  // Ensure device + create trail atomically to prevent race conditions
  const deviceId = importDeviceId(userId);
  const trail = await db.$transaction(async (tx) => {
    await tx.device.upsert({
      where: { id: deviceId },
      create: { id: deviceId, userId },
      update: {},
    });

    return tx.trail.create({
      data: {
        id: trailId,
        userId,
        deviceId,
        label,
        labelSource,
        labelUpdatedAt: now,
        savedAt: now,
        nodeCount,
        rootUrl,
        rootTitle,
        rootFavicon,
        payload: tree as object,
      },
    });
  });

  return jsonNoStore({ id: trail.id }, { status: 201 });
}

function extractLabelFromTree(tree: Record<string, unknown>): string | null {
  const root = tree.root as Record<string, unknown> | null;
  if (!root) return null;
  const data = root.data as Record<string, unknown> | null | undefined;
  const title = data?.title;
  return typeof title === "string" && title ? title : null;
}
