import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { getUserFromToken } from "@/src/lib/auth";
import { jsonFail, jsonOk } from "@/src/server/backend/error-response";
import { toTrailSummary } from "@/src/server/backend/trail-serializers";
import { ensureUser } from "@/src/server/backend/user";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { db } from "@trail/db";
import type { DbLabelSource } from "@/src/server/backend/trail-serializers";
import { rateLimit } from "@/src/server/api/rate-limit";
import { corsHeaders, optionsResponse } from "@/src/server/api/cors";
import { trailsListQuerySchema } from "@/src/server/api/schemas";
import { parseQuery } from "@/src/server/api/validate";

export const runtime = "nodejs";

type TrailCursor = {
  updatedAt: Date;
  id: string;
};

function encodeCursor(cursor: TrailCursor): string {
  return `${cursor.updatedAt.toISOString()}|${cursor.id}`;
}

function parseCursor(raw: string | null): TrailCursor | null {
  if (!raw) {
    return null;
  }

  const sepIndex = raw.indexOf("|");
  if (sepIndex === -1) {
    return null;
  }

  const updatedAtRaw = raw.slice(0, sepIndex);
  const id = raw.slice(sepIndex + 1);
  if (!updatedAtRaw || !id) {
    return null;
  }

  const updatedAt = new Date(updatedAtRaw);
  if (Number.isNaN(updatedAt.getTime())) {
    return null;
  }

  return { updatedAt, id };
}

async function resolveUser(request: Request) {
  // 1. Try extension bearer token
  const bearer = getBearerToken(request.headers);
  if (bearer) {
    const ext = await verifyExtensionToken(bearer);
    if (ext?.sub) {
      return ensureUser({ sub: ext.sub }, db);
    }

    // Try as extension token via getUserFromToken fallback
    const user = await getUserFromToken(bearer);
    if (user) {
      return { id: user.id, email: user.email, name: user.name, imageUrl: user.imageUrl };
    }
  }

  // 2. Try Supabase cookie session
  const supabase = await createSupabaseServerClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (supabaseUser) {
    return ensureUser({
      sub: supabaseUser.id,
      email: supabaseUser.email ?? undefined,
      name: supabaseUser.user_metadata?.full_name ?? supabaseUser.user_metadata?.name,
    }, supabase);
  }

  return null;
}

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(ip, "default");
  if (!rl.ok) {
    return jsonFail("RATE_LIMITED", "Too many requests", { status: 429 });
  }

  const user = await resolveUser(request);
  if (!user) {
    return jsonFail("unauthorized", "Unauthorized.", { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = parseQuery(trailsListQuerySchema, url.searchParams);
  if (!parsed.ok) {
    return jsonFail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input", { status: 400 });
  }

  const { limit, cursor: cursorRaw, includeDeleted } = parsed.data;
  const cursor = parseCursor(cursorRaw ?? null);

  let trailsQuery = db
    .from("trails")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (!includeDeleted) {
    trailsQuery = trailsQuery.is("deleted_at", null);
  }

  if (cursor) {
    trailsQuery = trailsQuery.or(
      `updated_at.lt.${cursor.updatedAt.toISOString()},and(updated_at.eq.${cursor.updatedAt.toISOString()},id.lt.${cursor.id})`,
    );
  }

  let countQuery = db
    .from("trails")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (!includeDeleted) {
    countQuery = countQuery.is("deleted_at", null);
  }

  const [trailsResult, countResult] = await Promise.all([trailsQuery, countQuery]);

  if (trailsResult.error) {
    return jsonFail("internal_error", "Failed to fetch trails.", { status: 500 });
  }
  if (countResult.error) {
    return jsonFail("internal_error", "Failed to count trails.", { status: 500 });
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
  };

  const rows = trailsResult.data as DbTrailRow[];
  const totalCount = countResult.count ?? 0;

  const hasNext = rows.length > limit;
  const items = hasNext ? rows.slice(0, limit) : rows;
  const lastItem = items[items.length - 1];
  const nextCursor =
    hasNext && lastItem
      ? encodeCursor({ updatedAt: new Date(lastItem.updated_at), id: lastItem.id })
      : null;

  return jsonOk({
    items: items.map((row) =>
      toTrailSummary({
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
        deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
      }),
    ),
    nextCursor,
    totalCount,
  });
}
