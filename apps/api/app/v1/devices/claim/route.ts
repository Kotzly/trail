import { getBearerToken } from "@/src/server/auth/headers";
import { verifyExtensionToken } from "@/src/server/auth/extension-auth";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { claimDevice } from "@/src/server/devices";
import { getUserById } from "@/src/server/user";

export const runtime = "nodejs";

type DeviceMetadataInput = {
  deviceName?: string | null;
  os?: string | null;
  locale?: string | null;
  timezone?: string | null;
  browserName?: string | null;
  browserVersion?: string | null;
  extensionVersion?: string | null;
};

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value;
  return undefined;
}

function mapDevice(device: {
  id: string;
  userId: string;
  status: string;
  deviceName?: string | null;
  os?: string | null;
  locale?: string | null;
  timezone?: string | null;
  browserName?: string | null;
  browserVersion?: string | null;
  extensionVersion?: string | null;
  lastSeenAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: device.id,
    userId: device.userId,
    status: device.status,
    deviceName: device.deviceName ?? null,
    os: device.os ?? null,
    locale: device.locale ?? null,
    timezone: device.timezone ?? null,
    browserName: device.browserName ?? null,
    browserVersion: device.browserVersion ?? null,
    extensionVersion: device.extensionVersion ?? null,
    lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString()
  };
}

function mapSession(session: {
  id: string;
  deviceId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  lastSeenAt?: Date | null;
  revokedAt?: Date | null;
}) {
  return {
    id: session.id,
    deviceId: session.deviceId,
    userId: session.userId,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    lastSeenAt: session.lastSeenAt ? session.lastSeenAt.toISOString() : null,
    revokedAt: session.revokedAt ? session.revokedAt.toISOString() : null
  };
}

export async function POST(request: Request) {
  const token = getBearerToken(request.headers);
  const extension = token ? verifyExtensionToken(token) : null;
  if (!extension?.sub) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const user = await getUserById(extension.sub);
  if (!user) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const metadata = body?.metadata as DeviceMetadataInput | undefined;
  if (!metadata || typeof metadata !== "object") {
    return jsonError("metadata_required", "Metadata is required.", { status: 400 });
  }

  const os = typeof metadata.os === "string" ? metadata.os.trim() : "";
  if (!os) {
    return jsonError("os_required", "OS is required.", { status: 400 });
  }

  const result = await claimDevice({
    userId: user.id,
    deviceId: typeof body?.deviceId === "string" ? body.deviceId : null,
    metadata: {
      deviceName: asNullableString(metadata.deviceName),
      os,
      locale: asNullableString(metadata.locale),
      timezone: asNullableString(metadata.timezone),
      browserName: asNullableString(metadata.browserName),
      browserVersion: asNullableString(metadata.browserVersion),
      extensionVersion: asNullableString(metadata.extensionVersion)
    }
  });

  return jsonNoStore({
    device: mapDevice(result.device),
    session: mapSession(result.session),
    sessionTtlDays: result.sessionTtlDays ?? null
  });
}
