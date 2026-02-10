import { getBearerToken } from "@/src/server/auth/headers";
import { verifyUserToken } from "@/src/server/auth/user-auth";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { ensureUser } from "@/src/server/user";
import { db } from "@trail/db";

export const runtime = "nodejs";

type DeviceSessionTtlDays = 7 | 30 | 90 | 180 | 365;

type DbTtl = "DAYS_7" | "DAYS_30" | "DAYS_90" | "DAYS_180" | "DAYS_365";

const TTL_TO_DB: Record<DeviceSessionTtlDays, DbTtl> = {
  7: "DAYS_7",
  30: "DAYS_30",
  90: "DAYS_90",
  180: "DAYS_180",
  365: "DAYS_365",
};

const DB_TO_TTL: Record<DbTtl, DeviceSessionTtlDays> = {
  DAYS_7: 7,
  DAYS_30: 30,
  DAYS_90: 90,
  DAYS_180: 180,
  DAYS_365: 365,
};

function toApiTtl(value: DbTtl | null | undefined): DeviceSessionTtlDays {
  return DB_TO_TTL[value ?? "DAYS_30"] ?? 30;
}

function toDbTtl(value: unknown): DbTtl | null {
  if (typeof value !== "number") return null;
  return TTL_TO_DB[value as DeviceSessionTtlDays] ?? null;
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

  const settings = await db.accountSettings.findUnique({
    where: { userId: user.id },
  });

  return jsonNoStore({
    deviceSessionTtlDays: toApiTtl(settings?.deviceSessionTtlDays ?? null),
  });
}

export async function PATCH(request: Request) {
  const token = getBearerToken(request.headers);
  const authUser = await verifyUserToken(token);
  if (!authUser) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const user = await ensureUser(authUser);
  if (!user) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ttl = toDbTtl(body?.deviceSessionTtlDays);
  if (!ttl) {
    return jsonError(
      "invalid_device_session_ttl",
      "Invalid device session TTL.",
      { status: 400 },
    );
  }

  const settings = await db.accountSettings.upsert({
    where: { userId: user.id },
    update: { deviceSessionTtlDays: ttl },
    create: { userId: user.id, deviceSessionTtlDays: ttl },
  });

  return jsonNoStore({
    deviceSessionTtlDays: toApiTtl(settings.deviceSessionTtlDays as DbTtl),
  });
}
