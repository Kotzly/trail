import { getBearerToken } from "@/src/server/backend/auth/headers";
import { resolveUserId } from "@/src/server/backend/auth/resolve-user";
import { jsonFail, jsonOk } from "@/src/server/backend/error-response";
import { getAuthSession } from "@/src/lib/auth";
import { db } from "@trail/db";
import { assertOk } from "@trail/db/helpers";
import { randomUUID } from "crypto";
import { rateLimit } from "@/src/server/api/rate-limit";
import { optionsResponse } from "@/src/server/api/cors";
import { trailsImportBodySchema } from "@/src/server/api/schemas";
import { parseBody } from "@/src/server/api/validate";

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
export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(ip, "default");
  if (!rl.ok) {
    return jsonFail("RATE_LIMITED", "Too many requests", { status: 429 });
  }

  // Resolve authenticated user — Bearer token for extension, Supabase session for web UI
  const bearerToken = getBearerToken(request.headers);
  let userId = await resolveUserId(bearerToken);
  if (!userId) {
    const session = await getAuthSession();
    userId = session?.user.id ?? null;
  }
  if (!userId) {
    return jsonFail("unauthorized", "Unauthorized.", { status: 401 });
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonFail("invalid_body", "Invalid JSON body.", { status: 400 });
  }

  const parsed = parseBody(trailsImportBodySchema, body);
  if (!parsed.ok) {
    return jsonFail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input", { status: 400 });
  }

  const bundle = parsed.data;
  const tree = bundle.tree;
  const treeObj = tree as Record<string, unknown>;
  const nodeCount = tree.nodeCount;

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
  const deviceId = importDeviceId(userId);

  // Upsert the import device (no-op if it already exists)
  assertOk(
    await db
      .from("devices")
      .upsert({ id: deviceId, user_id: userId }, { onConflict: "id", ignoreDuplicates: true }),
  );

  // Create the trail
  const trailResult = await db
    .from("trails")
    .insert({
      id: trailId,
      user_id: userId,
      device_id: deviceId,
      label,
      label_source: labelSource,
      label_updated_at: now.toISOString(),
      saved_at: now.toISOString(),
      node_count: nodeCount,
      root_url: rootUrl,
      root_title: rootTitle,
      root_favicon: rootFavicon,
      payload: tree,
    })
    .select("id")
    .single();

  if (trailResult.error) {
    return jsonFail("internal_error", "Failed to create trail.", { status: 500 });
  }

  return jsonOk({ id: trailResult.data.id }, { status: 201 });
}

function extractLabelFromTree(tree: Record<string, unknown>): string | null {
  const root = tree.root as Record<string, unknown> | null;
  if (!root) return null;
  const data = root.data as Record<string, unknown> | null | undefined;
  const title = data?.title;
  return typeof title === "string" && title ? title : null;
}
