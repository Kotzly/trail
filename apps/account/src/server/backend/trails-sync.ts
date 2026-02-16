type TrailLabelSource = "USER" | "AUTO" | "SYSTEM";

import { type JsonValue, toPrismaJsonInput } from "./json";

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
  payload: JsonValue;
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

function normalizeDeviceId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

async function ensureSyncDevices(params: {
  db: Awaited<typeof import("@trail/db")>["db"];
  userId: string;
  primaryDeviceId: string;
  trails: TrailSyncRecord[];
  now: Date;
}) {
  const { db, userId, primaryDeviceId, trails, now } = params;
  const ids = new Set<string>();
  ids.add(primaryDeviceId);

  for (const trail of trails) {
    const deviceId = normalizeDeviceId(trail.deviceId);
    if (deviceId) {
      ids.add(deviceId);
    }
  }

  const deviceIds = Array.from(ids);
  const existing = await db.device.findMany({
    where: {
      id: { in: deviceIds },
    },
    select: {
      id: true,
      userId: true,
    },
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
      // Device was previously associated with another user — reassign to current user.
      // This is safe because deviceId is a local identifier, not sensitive.
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
    // Most commonly happens in dev/e2e when the DB was reset but the client
    // still holds a previously issued extension JWT for a now-missing user.
    throw new Error("user_not_found");
  }
}

function toDbData(params: {
  trail: TrailSyncRecord;
  userId: string;
  deviceId: string;
  includeCreatedAt: boolean;
}) {
  const { trail, userId, deviceId, includeCreatedAt } = params;
  const resolvedDeviceId = normalizeDeviceId(trail.deviceId) ?? deviceId;

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
    payload: toPrismaJsonInput(trail.payload),
    deletedAt: trail.deletedAt ?? null,
  };

  if (!includeCreatedAt) {
    return baseData;
  }

  return {
    id: trail.id,
    ...baseData,
    createdAt: trail.createdAt,
  };
}

export async function syncTrails(
  input: TrailSyncInput,
): Promise<TrailSyncOutput> {
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
    trails: input.trails,
    now,
  });

  await db.trail.deleteMany({
    where: {
      userId: input.userId,
      deletedAt: { lt: cleanupBefore },
    },
  });

  const clientTrails = normalizeClientTrails(input.trails);
  const ids = clientTrails.map((trail) => trail.id);

  const existing = ids.length
    ? await db.trail.findMany({
        where: {
          userId: input.userId,
          id: { in: ids },
        },
      })
    : [];

  const existingMap = new Map(existing.map((trail) => [trail.id, trail]));
  const operations: Array<ReturnType<typeof db.trail.update>> = [];

  for (const trail of clientTrails) {
    const serverTrail = existingMap.get(trail.id) ?? null;
    const merge = mergeTrailUpdates(serverTrail, trail);
    if (!merge.applied) {
      continue;
    }

    if (serverTrail) {
      operations.push(
        db.trail.update({
          where: { id: serverTrail.id },
          data: toDbData({
            trail,
            userId: input.userId,
            deviceId: primaryDeviceId,
            includeCreatedAt: false,
          }),
        }),
      );
    } else {
      operations.push(
        db.trail.create({
          data: toDbData({
            trail,
            userId: input.userId,
            deviceId: primaryDeviceId,
            includeCreatedAt: true,
          }),
        }),
      );
    }
  }

  if (operations.length) {
    await db.$transaction(operations);
  }

  const updates = await db.trail.findMany({
    where: {
      userId: input.userId,
      updatedAt: { gt: input.clientSyncAt },
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
      payload: trail.payload,
      deletedAt: trail.deletedAt ?? null,
    })),
  };
}

export type {
  TrailSyncInput,
  TrailSyncOutput,
  TrailSyncRecord,
  TrailLabelSource,
};
