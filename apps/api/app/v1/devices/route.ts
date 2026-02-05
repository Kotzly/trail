import { getBearerToken } from "@/src/server/auth/headers";
import { verifyUserToken } from "@/src/server/auth/user-auth";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { listDevices } from "@/src/server/devices";
import { ensureUser } from "@/src/server/user";

export const runtime = "nodejs";

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
    updatedAt: device.updatedAt.toISOString(),
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
    revokedAt: session.revokedAt ? session.revokedAt.toISOString() : null,
  };
}

export async function GET(request: Request) {
  const token = getBearerToken(request.headers);
  const authUser = await verifyUserToken(token);
  if (!authUser) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const user = await ensureUser(authUser);
  if (!user) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const devices = await listDevices(user.id);

  return jsonNoStore({
    devices: devices.map((device) => {
      const session = device.sessions[0];
      return {
        ...mapDevice(device),
        ...(session ? { session: mapSession(session) } : {}),
      };
    }),
  });
}
