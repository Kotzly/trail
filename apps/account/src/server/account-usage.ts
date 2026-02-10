import { getAuthTokenFromCookies } from "@/src/lib/auth";
import { internalApiJson } from "@/src/server/internal-api";

export type AccountTrailSummary = {
  id: string;
  label: string;
  rootTitle: string | null;
  savedAt: string;
  nodeCount: number;
};

export type AccountDeviceSummary = {
  id: string;
  status: string;
  deviceName: string | null;
  os: string | null;
  browserName: string | null;
  lastSeenAt: string | null;
  updatedAt: string;
  session?: {
    id: string;
    lastSeenAt: string | null;
    updatedAt: string;
    revokedAt: string | null;
  };
};

export type AccountUsageSnapshot = {
  trailCount: number;
  activeSessionCount: number;
  recentTrails: AccountTrailSummary[];
  devices: AccountDeviceSummary[];
};

type ApiTrailsResponse = {
  items?: Array<{
    id: string;
    label: string;
    rootTitle: string | null;
    savedAt: string;
    nodeCount: number;
  }>;
  totalCount?: number;
};

type ApiDevicesResponse = {
  devices?: Array<{
    id: string;
    status: string;
    deviceName?: string | null;
    os?: string | null;
    browserName?: string | null;
    lastSeenAt?: string | null;
    updatedAt: string;
    session?: {
      id: string;
      lastSeenAt?: string | null;
      updatedAt: string;
      revokedAt?: string | null;
    };
  }>;
};

const EMPTY_USAGE_SNAPSHOT: AccountUsageSnapshot = {
  trailCount: 0,
  activeSessionCount: 0,
  recentTrails: [],
  devices: [],
};

function toRecentTrails(response: ApiTrailsResponse | null): AccountTrailSummary[] {
  if (!Array.isArray(response?.items)) {
    return [];
  }

  return response.items.map((item) => ({
    id: item.id,
    label: item.label,
    rootTitle: item.rootTitle ?? null,
    savedAt: item.savedAt,
    nodeCount: item.nodeCount,
  }));
}

function toDevices(response: ApiDevicesResponse | null): AccountDeviceSummary[] {
  if (!Array.isArray(response?.devices)) {
    return [];
  }

  return response.devices.map((device) => ({
    id: device.id,
    status: device.status,
    deviceName: device.deviceName ?? null,
    os: device.os ?? null,
    browserName: device.browserName ?? null,
    lastSeenAt: device.lastSeenAt ?? null,
    updatedAt: device.updatedAt,
    ...(device.session
      ? {
          session: {
            id: device.session.id,
            lastSeenAt: device.session.lastSeenAt ?? null,
            updatedAt: device.session.updatedAt,
            revokedAt: device.session.revokedAt ?? null,
          },
        }
      : {}),
  }));
}

function countActiveDevices(devices: AccountDeviceSummary[]): number {
  return devices.filter((device) => device.status === "ACTIVE").length;
}

export async function getAccountUsageSnapshot(): Promise<AccountUsageSnapshot> {
  const token = await getAuthTokenFromCookies();
  if (!token) {
    return EMPTY_USAGE_SNAPSHOT;
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  const [trailsResponse, devicesResponse] = await Promise.all([
    internalApiJson<ApiTrailsResponse>("/api/v1/trails?limit=5", {
      method: "GET",
      headers: authHeaders,
    }).catch(() => null),
    internalApiJson<ApiDevicesResponse>("/api/v1/devices", {
      method: "GET",
      headers: authHeaders,
    }).catch(() => null),
  ]);

  const recentTrails = toRecentTrails(trailsResponse);
  const devices = toDevices(devicesResponse);
  const activeSessionCount = countActiveDevices(devices);

  const trailCount =
    typeof trailsResponse?.totalCount === "number"
      ? trailsResponse.totalCount
      : recentTrails.length;

  return {
    trailCount,
    activeSessionCount,
    recentTrails,
    devices,
  };
}
