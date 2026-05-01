import { db } from "@trail/db";
import { getAuthSession } from "@/src/lib/auth";

export type TrailSummary = {
  id: string;
  label: string;
  labelSource: "user" | "auto" | "system";
  createdAt: string;
  updatedAt: string;
  savedAt: string;
  nodeCount: number;
  rootUrl: string | null;
  rootTitle: string | null;
  rootFavicon: string | null;
  deviceId: string;
  deletedAt: string | null;
};

export type TrailDetail = TrailSummary & {
  userId: string;
  labelUpdatedAt: string;
  payload: unknown;
  deletedAt: string | null;
};

type TrailsListResponse = {
  items: TrailSummary[];
  nextCursor: string | null;
  totalCount: number;
};

type TrailCursor = {
  updatedAt: Date;
  id: string;
};

function toApiLabelSource(value: string): "user" | "auto" | "system" {
  const lowered = value.toLowerCase();
  if (lowered === "auto" || lowered === "system") {
    return lowered;
  }
  return "user";
}

function parseCursor(raw: string | undefined): TrailCursor | null {
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

function encodeCursor(cursor: TrailCursor): string {
  return `${cursor.updatedAt.toISOString()}|${cursor.id}`;
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
  payload?: unknown;
};

function toTrailSummary(row: DbTrailRow): TrailSummary {
  return {
    id: row.id,
    label: row.label,
    labelSource: toApiLabelSource(row.label_source),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    savedAt: row.saved_at,
    nodeCount: row.node_count,
    rootUrl: row.root_url,
    rootTitle: row.root_title,
    rootFavicon: row.root_favicon,
    deviceId: row.device_id,
    deletedAt: row.deleted_at,
  };
}

async function resolveAuthedUserId(): Promise<string | null> {
  const session = await getAuthSession();
  return session?.user.id ?? null;
}

export async function getTrailsList(options?: {
  limit?: number;
  cursor?: string;
}): Promise<TrailsListResponse | null> {
  const userId = await resolveAuthedUserId();
  if (!userId) {
    return null;
  }

  const limit =
    typeof options?.limit === "number" && options.limit > 0 && options.limit <= 200
      ? options.limit
      : 50;
  const cursor = parseCursor(options?.cursor);

  let trailsQuery = db
    .from("trails")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    trailsQuery = trailsQuery.or(
      `updated_at.lt.${cursor.updatedAt.toISOString()},and(updated_at.eq.${cursor.updatedAt.toISOString()},id.lt.${cursor.id})`,
    );
  }

  const [trailsResult, countResult] = await Promise.all([
    trailsQuery,
    db
      .from("trails")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null),
  ]);

  if (trailsResult.error) {
    throw new Error(`Failed to fetch trails: ${trailsResult.error.message}`);
  }
  if (countResult.error) {
    throw new Error(`Failed to count trails: ${countResult.error.message}`);
  }

  const rows = trailsResult.data as DbTrailRow[];
  const totalCount = countResult.count ?? 0;

  const hasNext = rows.length > limit;
  const items = hasNext ? rows.slice(0, limit) : rows;
  const lastItem = items[items.length - 1];
  const nextCursor =
    hasNext && lastItem
      ? encodeCursor({ updatedAt: new Date(lastItem.updated_at), id: lastItem.id })
      : null;

  return {
    items: items.map(toTrailSummary),
    nextCursor,
    totalCount,
  };
}

export async function getTrailById(id: string): Promise<TrailDetail | null> {
  const userId = await resolveAuthedUserId();
  if (!userId) {
    return null;
  }

  const result = await db
    .from("trails")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw new Error(`Failed to fetch trail: ${result.error.message}`);
  }
  if (!result.data) {
    return null;
  }

  const row = result.data as DbTrailRow;

  return {
    ...toTrailSummary(row),
    userId: row.user_id,
    labelUpdatedAt: row.label_updated_at,
    payload: row.payload,
    deletedAt: row.deleted_at,
  };
}
