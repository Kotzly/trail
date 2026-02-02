import { db } from "@trail/db";

type SessionTtlPreset = "DAYS_7" | "DAYS_30" | "DAYS_90" | "DAYS_180" | "DAYS_365";

type DeviceMetadata = {
  deviceName?: string | null;
  os?: string | null;
  locale?: string | null;
  timezone?: string | null;
  browserName?: string | null;
  browserVersion?: string | null;
  extensionVersion?: string | null;
};

type DeviceClaimInput = {
  userId: string;
  deviceId?: string | null;
  metadata: DeviceMetadata;
};

const TTL_DAYS_BY_PRESET: Record<SessionTtlPreset, number> = {
  DAYS_7: 7,
  DAYS_30: 30,
  DAYS_90: 90,
  DAYS_180: 180,
  DAYS_365: 365
};

function resolveTtlDays(preset: SessionTtlPreset | null | undefined): number {
  return TTL_DAYS_BY_PRESET[preset ?? "DAYS_30"] ?? 30;
}

function buildMetadataUpdate(metadata: DeviceMetadata): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (metadata.deviceName !== undefined) data.deviceName = metadata.deviceName;
  if (metadata.os !== undefined) data.os = metadata.os;
  if (metadata.locale !== undefined) data.locale = metadata.locale;
  if (metadata.timezone !== undefined) data.timezone = metadata.timezone;
  if (metadata.browserName !== undefined) data.browserName = metadata.browserName;
  if (metadata.browserVersion !== undefined) data.browserVersion = metadata.browserVersion;
  if (metadata.extensionVersion !== undefined) data.extensionVersion = metadata.extensionVersion;
  return data;
}

async function getSessionTtlDays(userId: string): Promise<number> {
  const settings = await db.accountSettings.findUnique({
    where: { userId },
    select: { deviceSessionTtlDays: true }
  });
  return resolveTtlDays(settings?.deviceSessionTtlDays ?? null);
}

async function refreshSession(params: {
  deviceId: string;
  userId: string;
  ttlDays: number;
  now: Date;
}) {
  const { deviceId, userId, ttlDays, now } = params;
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

  const existing = await db.deviceSession.findFirst({
    where: {
      deviceId,
      userId,
      revokedAt: null,
      expiresAt: { gt: now }
    },
    orderBy: { expiresAt: "desc" }
  });

  if (existing) {
    return db.deviceSession.update({
      where: { id: existing.id },
      data: { expiresAt, lastSeenAt: now }
    });
  }

  return db.deviceSession.create({
    data: {
      deviceId,
      userId,
      expiresAt,
      lastSeenAt: now
    }
  });
}

export async function claimDevice(input: DeviceClaimInput) {
  const now = new Date();
  const metadata = buildMetadataUpdate(input.metadata);
  const deviceId = input.deviceId?.trim() || null;

  let device = null as null | Awaited<ReturnType<typeof db.device.findUnique>>;

  if (deviceId) {
    const existing = await db.device.findUnique({ where: { id: deviceId } });
    if (existing && existing.userId === input.userId && existing.status !== "REVOKED") {
      device = await db.device.update({
        where: { id: existing.id },
        data: {
          ...metadata,
          lastSeenAt: now
        }
      });
    }
  }

  if (!device) {
    device = await db.device.create({
      data: {
        userId: input.userId,
        ...metadata,
        lastSeenAt: now
      }
    });
  }

  const ttlDays = await getSessionTtlDays(input.userId);
  const session = await refreshSession({
    deviceId: device.id,
    userId: input.userId,
    ttlDays,
    now
  });

  return { device, session, sessionTtlDays: ttlDays };
}

export async function listDevices(userId: string) {
  return db.device.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      sessions: {
        where: { revokedAt: null },
        orderBy: { expiresAt: "desc" },
        take: 1
      }
    }
  });
}

export type { DeviceClaimInput, DeviceMetadata, SessionTtlPreset };
