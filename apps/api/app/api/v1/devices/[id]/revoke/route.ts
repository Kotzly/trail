import { getBearerToken } from "@/src/server/auth/headers";
import { verifyUserToken } from "@/src/server/auth/user-auth";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { ensureUser } from "@/src/server/user";
import { db } from "@trail/db";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return jsonError("device_not_found", "Device not found.", { status: 404 });
  }

  const token = getBearerToken(request.headers);
  const authUser = await verifyUserToken(token);
  if (!authUser) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const user = await ensureUser(authUser);
  if (!user) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const device = await db.device.findUnique({ where: { id } });
  if (!device || device.userId !== user.id) {
    return jsonError("device_not_found", "Device not found.", { status: 404 });
  }

  const now = new Date();
  const updated = await db.device.update({
    where: { id },
    data: { status: "REVOKED" },
  });

  await db.deviceSession.updateMany({
    where: { deviceId: id, revokedAt: null },
    data: { revokedAt: now },
  });

  return jsonNoStore(mapDevice(updated));
}
