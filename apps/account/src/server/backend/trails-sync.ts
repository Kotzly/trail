type TrailLabelSource = "USER" | "AUTO" | "SYSTEM";

import { toPrismaJsonInput } from "./json";
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

async function ensureSyncDevices(params: {
  db: Awaited<typeof import("@trail/db")>["db"];
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
  const existing = await db.device.findMany({
    where: { id: { in: deviceIds } },
    select: { id: true, userId: true },
  });

  const existingById = new Map(existing.map((device) => [device.id, device]));
  const missing: string[] = [];

  for (const deviceId of deviceIds) {
    const device = existingById.get(deviceId);
    if (!device) {
      missing.push(deviceId);
      continue;
    }
    if (device.userId !== userId) {
      await db.device.update({
        where: { id: deviceId },
        data: { userId },
      });
      continue;
    }
  }

  if (missing.length) {
    await db.device.createMany({
      data: missing.map((deviceId) => ({
        id: deviceId,
        userId,
        lastSeenAt: deviceId === primaryDeviceId ? now : null,
      })),
      skipDuplicates: true,
    });
  }

  await db.device.update({
    where: { id: primaryDeviceId },
    data: { lastSeenAt: now },
  });
}

async function ensureUserExists(params: {
  db: Awaited<typeof import("@trail/db")>["db"];
  userId: string;
}) {
  const { db, userId } = params;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
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
  await db.trail.deleteMany({
    where: {
      userId: input.userId,
      deletedAt: { lt: cleanupBefore },
    },
  });

  // Return metadata-only updates since clientSyncAt
  const updates = await db.trail.findMany({
    where: {
      userId: input.userId,
      updatedAt: { gt: input.clientSyncAt },
    },
    select: {
      id: true,
      deviceId: true,
      label: true,
      labelSource: true,
      labelUpdatedAt: true,
      createdAt: true,
      updatedAt: true,
      savedAt: true,
      nodeCount: true,
      rootUrl: true,
      rootTitle: true,
      rootFavicon: true,
      deletedAt: true,
      // No payload!
    },
  });

  return {
    serverSyncAt: now,
    updates: updates.map((trail) => ({
      id: trail.id,
      deviceId: trail.deviceId,
      label: trail.label,
      labelSource: trail.labelSource as TrailLabelSource,
      labelUpdatedAt: trail.labelUpdatedAt,
      createdAt: trail.createdAt,
      updatedAt: trail.updatedAt,
      savedAt: trail.savedAt,
      nodeCount: trail.nodeCount,
      rootUrl: trail.rootUrl ?? null,
      rootTitle: trail.rootTitle ?? null,
      rootFavicon: trail.rootFavicon ?? null,
      deletedAt: trail.deletedAt ?? null,
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

  const trailDeviceId = normalizeDeviceId(input.trail.deviceId) ?? primaryDeviceId;

  await ensureSyncDevices({
    db,
    userId: input.userId,
    primaryDeviceId,
    extraDeviceIds: trailDeviceId !== primaryDeviceId ? [trailDeviceId] : undefined,
    now: new Date(),
  });

  const existing = await db.trail.findFirst({
    where: { id: input.trail.id, userId: input.userId },
  });

  const merge = mergeTrailUpdates(
    existing,
    { updatedAt: input.trail.updatedAt, deletedAt: input.trail.deletedAt },
  );

  if (!merge.applied) {
    return {
      updatedAt: existing?.updatedAt ?? input.trail.updatedAt,
      applied: false,
    };
  }

  const data = {
    userId: input.userId,
    deviceId: trailDeviceId,
    label: input.trail.label,
    labelSource: input.trail.labelSource,
    labelUpdatedAt: input.trail.labelUpdatedAt,
    updatedAt: input.trail.updatedAt,
    savedAt: input.trail.savedAt,
    nodeCount: input.trail.nodeCount,
    rootUrl: input.trail.rootUrl ?? null,
    rootTitle: input.trail.rootTitle ?? null,
    rootFavicon: input.trail.rootFavicon ?? null,
    payload: toPrismaJsonInput(input.trail.payload),
    deletedAt: input.trail.deletedAt ?? null,
  };

  if (existing) {
    const updated = await db.trail.update({
      where: { id: existing.id },
      data,
    });
    return { updatedAt: updated.updatedAt, applied: true };
  }

  const created = await db.trail.create({
    data: {
      id: input.trail.id,
      ...data,
      createdAt: input.trail.createdAt,
    },
  });
  return { updatedAt: created.updatedAt, applied: true };
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
