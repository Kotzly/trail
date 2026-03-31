import { getBearerToken } from "@/src/server/backend/auth/headers";
import { resolveUserId } from "@/src/server/backend/auth/resolve-user";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";
import { toTrailRecord, type DbLabelSource } from "@/src/server/backend/trail-serializers";
import { db } from "@trail/db";

export const runtime = "nodejs";

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

export async function POST(
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
    .update({ deleted_at: null, updated_at: now.toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
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

  const row = result.data as DbTrailRow;

  return jsonNoStore(
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
