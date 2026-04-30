type TrailLabelSource = "USER" | "AUTO" | "SYSTEM";

import type { JsonValue } from "./json";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/**
 * Input for the lightweight index-sync endpoint.
 * The client sends only its deviceId and last-known sync cursor;
 * the server returns metadata-only updates.
 */
type IndexSyncInput = {
  userId: string;
  deviceId: string;
  clientSyncAt: Date;
};

type TrailMetaRecord = {
  id: string;
  deviceId: string;
  label: string;
  labelSource: TrailLabelSource;
  labelUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  savedAt: Date;
  nodeCount: number;
  rootUrl: string | null;
  rootTitle: string | null;
  rootFavicon: string | null;
  deletedAt: Date | null;
};

type IndexSyncOutput = {
  serverSyncAt: Date;
  updates: TrailMetaRecord[];
};

/**
 * Input for the per-tree upsert endpoint (PUT /trails/:id).
 */
type TrailUpsertInput = {
  userId: string;
  deviceId: string;
  trail: {
    id: string;
    deviceId?: string | null;
    label: string;
    labelSource: TrailLabelSource;
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
  };
};

type TrailUpsertOutput = {
  updatedAt: Date;
  applied: boolean;
};

export class SyncError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400, message?: string) {
    super(message ?? code);
    this.name = "SyncError";
    this.code = code;
    this.status = status;
  }
}

const TOMBSTONE_RETENTION_DAYS = 30;
const TOMBSTONE_RETENTION_MS = TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/*  Merge logic                                                        */
/* ------------------------------------------------------------------ */

function isStaleAfterTombstone(params: {
  serverDeletedAt: Date | null | undefined;
  clientUpdatedAt: Date;
}): boolean {
  const { serverDeletedAt, clientUpdatedAt } = params;
  if (!serverDeletedAt) return false;
  return clientUpdatedAt.getTime() <= serverDeletedAt.getTime();
}

export function mergeTrailUpdates(
  server: { updatedAt: Date; deletedAt?: Date | null } | null,
  client: { updatedAt: Date; deletedAt?: Date | null },
): { applied: boolean } {
  if (!server) {
    return { applied: true };
  }

  if (
    isStaleAfterTombstone({
      serverDeletedAt: server.deletedAt,
      clientUpdatedAt: client.updatedAt,
    })
  ) {
    return { applied: false };
  }

  const serverUpdatedAt = server.updatedAt.getTime();
  const clientUpdatedAt = client.updatedAt.getTime();
  if (serverUpdatedAt >= clientUpdatedAt) {
    return { applied: false };
  }

  return { applied: true };
}

/* ------------------------------------------------------------------ */
/*  Device helpers                                                     */
/* ------------------------------------------------------------------ */

function normalizeDeviceId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

type DbClient = Awaited<typeof import("@trail/db")>["db"];

async function ensureSyncDevices(params: {
  db: DbClient;
  userId: string;
  primaryDeviceId: string;
  extraDeviceIds?: string[];
  now: Date;
}) {
  const { db, userId, primaryDeviceId, now } = params;
  const ids = new Set<string>();
  ids.add(primaryDeviceId);
  if (params.extraDeviceIds) {
    for (const id of params.extraDeviceIds) {
      if (id) ids.add(id);
    }
  }

  const deviceIds = Array.from(ids);

  // Fetch existing devices
  const existingResult = await db
    .from("devices")
    .select("id, user_id")
    .in("id", deviceIds);

  if (existingResult.error) {
    throw new Error(`Failed to fetch devices: ${existingResult.error.message}`);
  }

  const existing = existingResult.data as { id: string; user_id: string }[];
  const existingById = new Map(existing.map((device) => [device.id, device]));
  const missing: string[] = [];

  for (const deviceId of deviceIds) {
    const device = existingById.get(deviceId);
    if (!device) {
      missing.push(deviceId);
      continue;
    }
    // Hard reject when the same device id is presented under a different
    // user. The extension is responsible for wiping per-user state on
    // user-change (auth-orchestrator.runUserChangeWipeIfNeeded), which
    // includes regenerating the device id. Silent reassignment used to
    // mask cross-tenant data leakage and broke trails referencing the
    // previous owner. (DATA-002)
    if (device.user_id !== userId) {
      throw new SyncError("device_user_mismatch", 409);
    }
  }

  if (missing.length) {
    const upsertResult = await db.from("devices").upsert(
      missing.map((deviceId) => ({
        id: deviceId,
        user_id: userId,
        last_seen_at: deviceId === primaryDeviceId ? now.toISOString() : null,
      })),
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (upsertResult.error) {
      throw new Error(
        `Failed to create devices: ${upsertResult.error.message}`,
      );
    }
  }

  const lastSeenResult = await db
    .from("devices")
    .update({ last_seen_at: now.toISOString() })
    .eq("id", primaryDeviceId);

  if (lastSeenResult.error) {
    throw new Error(
      `Failed to update last_seen_at: ${lastSeenResult.error.message}`,
    );
  }
}

async function ensureUserExists(params: { db: DbClient; userId: string }) {
  const { db, userId } = params;
  const result = await db
    .from("users")
    .select("id")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw new Error(`Failed to verify user: ${result.error.message}`);
  }
  if (!result.data) {
    throw new Error("user_not_found");
  }
}

/* ------------------------------------------------------------------ */
/*  Index sync (POST /trails/sync)                                     */
/* ------------------------------------------------------------------ */

/**
 * Lightweight index sync: returns metadata-only updates since clientSyncAt.
 * No payloads, no client upserts. The client uses separate PUT/GET/DELETE
 * endpoints for per-tree operations.
 */
export async function syncTrailsIndex(
  input: IndexSyncInput,
): Promise<IndexSyncOutput> {
  const { db } = await import("@trail/db");
  const primaryDeviceId = normalizeDeviceId(input.deviceId);
  if (!primaryDeviceId) {
    throw new Error("device_id_required");
  }
  const now = new Date();
  const cleanupBefore = new Date(now.getTime() - TOMBSTONE_RETENTION_MS);

  await ensureUserExists({ db, userId: input.userId });

  await ensureSyncDevices({
    db,
    userId: input.userId,
    primaryDeviceId,
    now,
  });

  // Clean up old tombstones
  const deleteResult = await db
    .from("trails")
    .delete()
    .eq("user_id", input.userId)
    .lt("deleted_at", cleanupBefore.toISOString());

  if (deleteResult.error) {
    throw new Error(
      `Failed to clean up tombstones: ${deleteResult.error.message}`,
    );
  }

  // Return metadata-only updates since clientSyncAt
  const updatesResult = await db
    .from("trails")
    .select(
      "id, device_id, label, label_source, label_updated_at, created_at, updated_at, saved_at, node_count, root_url, root_title, root_favicon, deleted_at",
    )
    .eq("user_id", input.userId)
    .gt("updated_at", input.clientSyncAt.toISOString());

  if (updatesResult.error) {
    throw new Error(
      `Failed to fetch trail updates: ${updatesResult.error.message}`,
    );
  }

  type DbTrailMetaRow = {
    id: string;
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

  const rows = updatesResult.data as DbTrailMetaRow[];

  return {
    serverSyncAt: now,
    updates: rows.map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      label: row.label,
      labelSource: row.label_source as TrailLabelSource,
      labelUpdatedAt: new Date(row.label_updated_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      savedAt: new Date(row.saved_at),
      nodeCount: row.node_count,
      rootUrl: row.root_url ?? null,
      rootTitle: row.root_title ?? null,
      rootFavicon: row.root_favicon ?? null,
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    })),
  };
}

/* ------------------------------------------------------------------ */
/*  Per-tree upsert (PUT /trails/:id)                                  */
/* ------------------------------------------------------------------ */

/**
 * Upsert a single tree. Applies last-write-wins merge logic.
 * Returns whether the update was applied and the resulting updatedAt.
 */
export async function upsertTrail(
  input: TrailUpsertInput,
): Promise<TrailUpsertOutput> {
  const { db } = await import("@trail/db");
  const primaryDeviceId = normalizeDeviceId(input.deviceId);
  if (!primaryDeviceId) {
    throw new Error("device_id_required");
  }

  await ensureUserExists({ db, userId: input.userId });

  const trailDeviceId =
    normalizeDeviceId(input.trail.deviceId) ?? primaryDeviceId;

  await ensureSyncDevices({
    db,
    userId: input.userId,
    primaryDeviceId,
    extraDeviceIds:
      trailDeviceId !== primaryDeviceId ? [trailDeviceId] : undefined,
    now: new Date(),
  });

  const payload = {
    id: input.trail.id,
    user_id: input.userId,
    device_id: trailDeviceId,
    label: input.trail.label,
    label_source: input.trail.labelSource,
    label_updated_at: input.trail.labelUpdatedAt.toISOString(),
    created_at: input.trail.createdAt.toISOString(),
    updated_at: input.trail.updatedAt.toISOString(),
    saved_at: input.trail.savedAt.toISOString(),
    node_count: input.trail.nodeCount,
    root_url: input.trail.rootUrl ?? null,
    root_title: input.trail.rootTitle ?? null,
    root_favicon: input.trail.rootFavicon ?? null,
    payload: input.trail.payload,
    deleted_at: input.trail.deletedAt
      ? input.trail.deletedAt.toISOString()
      : null,
  };

  const { data, error } = await db.rpc("upsert_trail", {
    p_trail: payload as never,
  });
  if (error) {
    throw new Error(`upsert_trail RPC failed: ${error.message}`);
  }
  // RPC returns jsonb; the generated type widens to Json. Narrow at the
  // boundary — the SQL function in migration 016 always returns this shape.
  const result = data as {
    id: string;
    applied: boolean;
    updated_at: string;
  } | null;
  if (!result) {
    throw new Error("upsert_trail returned no data");
  }
  return {
    updatedAt: new Date(result.updated_at),
    applied: result.applied,
  };
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

export type {
  IndexSyncInput,
  IndexSyncOutput,
  TrailMetaRecord,
  TrailUpsertInput,
  TrailUpsertOutput,
  TrailLabelSource,
};
