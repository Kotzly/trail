import { getBearerToken } from "@/src/server/backend/auth/headers";
import { resolveUserId } from "@/src/server/backend/auth/resolve-user";
import { jsonFail, jsonOk } from "@/src/server/backend/error-response";
import {
  toTrailRecord,
  type DbLabelSource,
} from "@/src/server/backend/trail-serializers";
import { db } from "@trail/db";
import { rateLimit } from "@/src/server/api/rate-limit";
import { optionsResponse } from "@/src/server/api/cors";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(ip, "default");
  if (!rl.ok) {
    return jsonFail("RATE_LIMITED", "Too many requests", { status: 429 });
  }

  const { id } = await params;
  if (!id) {
    return jsonFail("trail_not_found", "Trail not found.", { status: 404 });
  }

  const token = getBearerToken(request.headers);
  const userId = await resolveUserId(token);
  if (!userId) {
    return jsonFail("unauthorized", "Unauthorized.", { status: 401 });
  }

  const now = new Date();

  const result = await db
    .from("trails")
    .update({ deleted_at: null, updated_at: now.toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .select()
    .single();

  if (result.error) {
    if (result.error.code === "PGRST116") {
      return jsonFail("trail_not_found", "Trail not found.", { status: 404 });
    }
    return jsonFail("internal_error", "Internal error.", { status: 500 });
  }
  if (!result.data) {
    return jsonFail("trail_not_found", "Trail not found.", { status: 404 });
  }

  const row = result.data;

  return jsonOk(
    toTrailRecord({
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
    }),
  );
}
