type TrailLabelSource = "USER" | "AUTO" | "SYSTEM";

type TrailSyncRecord = {
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
  payload: unknown;
  deletedAt?: Date | null;
};

type TrailSyncInput = {
  userId: string;
  deviceId: string;
  clientSyncAt: Date;
  trails: TrailSyncRecord[];
};

type TrailSyncOutput = {
  serverSyncAt: Date;
  updates: TrailSyncRecord[];
};

const TOMBSTONE_RETENTION_DAYS = 30;
const TOMBSTONE_RETENTION_MS = TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

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
  client: { updatedAt: Date; deletedAt?: Date | null }
): { applied: boolean } {
  if (!server) {
    return { applied: true };
  }

  if (isStaleAfterTombstone({ serverDeletedAt: server.deletedAt, clientUpdatedAt: client.updatedAt })) {
    return { applied: false };
  }

  const serverUpdatedAt = server.updatedAt.getTime();
  const clientUpdatedAt = client.updatedAt.getTime();
  if (serverUpdatedAt >= clientUpdatedAt) {
    return { applied: false };
  }

  return { applied: true };
}

function normalizeClientTrails(trails: TrailSyncRecord[]): TrailSyncRecord[] {
  const map = new Map<string, TrailSyncRecord>();
  for (const trail of trails) {
    const existing = map.get(trail.id);
    if (!existing || existing.updatedAt.getTime() < trail.updatedAt.getTime()) {
      map.set(trail.id, trail);
    }
  }
  return Array.from(map.values());
}

function toDbData(params: {
  trail: TrailSyncRecord;
  userId: string;
  deviceId: string;
  includeCreatedAt: boolean;
}) {
  const { trail, userId, deviceId, includeCreatedAt } = params;
  const resolvedDeviceId = trail.deviceId ?? deviceId;

  const baseData = {
    userId,
    deviceId: resolvedDeviceId,
    label: trail.label,
    labelSource: trail.labelSource,
    labelUpdatedAt: trail.labelUpdatedAt,
    updatedAt: trail.updatedAt,
    savedAt: trail.savedAt,
    nodeCount: trail.nodeCount,
    rootUrl: trail.rootUrl ?? null,
    rootTitle: trail.rootTitle ?? null,
    rootFavicon: trail.rootFavicon ?? null,
    payload: trail.payload,
    deletedAt: trail.deletedAt ?? null
  };

  if (!includeCreatedAt) {
    return baseData;
  }

  return {
    ...baseData,
    createdAt: trail.createdAt
  };
}

export async function syncTrails(input: TrailSyncInput): Promise<TrailSyncOutput> {
  const { db } = await import("@trail/db");
  const now = new Date();
  const cleanupBefore = new Date(now.getTime() - TOMBSTONE_RETENTION_MS);

  await db.trail.deleteMany({
    where: {
      userId: input.userId,
      deletedAt: { lt: cleanupBefore }
    }
  });

  const clientTrails = normalizeClientTrails(input.trails);
  const ids = clientTrails.map((trail) => trail.id);

  const existing = ids.length
    ? await db.trail.findMany({
        where: {
          userId: input.userId,
          id: { in: ids }
        }
      })
    : [];

  const existingMap = new Map(existing.map((trail) => [trail.id, trail]));

  for (const trail of clientTrails) {
    const serverTrail = existingMap.get(trail.id) ?? null;
    const merge = mergeTrailUpdates(serverTrail, trail);
    if (!merge.applied) {
      continue;
    }

    if (serverTrail) {
      await db.trail.update({
        where: { id: serverTrail.id },
        data: toDbData({ trail, userId: input.userId, deviceId: input.deviceId, includeCreatedAt: false })
      });
    } else {
      await db.trail.create({
        data: toDbData({ trail, userId: input.userId, deviceId: input.deviceId, includeCreatedAt: true })
      });
    }
  }

  const updates = await db.trail.findMany({
    where: {
      userId: input.userId,
      updatedAt: { gt: input.clientSyncAt }
    }
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
      payload: trail.payload,
      deletedAt: trail.deletedAt ?? null
    }))
  };
}

export type { TrailSyncInput, TrailSyncOutput, TrailSyncRecord, TrailLabelSource };
