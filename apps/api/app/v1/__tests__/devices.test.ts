import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  verifyUserToken: vi.fn(),
  verifyExtensionToken: vi.fn()
}));

const userMocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  getUserById: vi.fn()
}));

const deviceMocks = vi.hoisted(() => ({
  claimDevice: vi.fn(),
  listDevices: vi.fn()
}));

const dbMocks = vi.hoisted(() => ({
  db: {
    device: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    deviceSession: {
      updateMany: vi.fn()
    }
  }
}));

vi.mock("@/src/server/auth/user-auth", () => ({
  ...authMocks
}));

vi.mock("@/src/server/auth/extension-auth", () => ({
  ...authMocks
}));

vi.mock("@/src/server/user", () => ({
  ...userMocks
}));

vi.mock("@/src/server/devices", () => ({
  ...deviceMocks
}));

vi.mock("@trail/db", () => ({
  ...dbMocks
}));

import { POST as claimDevice } from "../devices/claim/route";
import { GET as listDevices } from "../devices/route";
import { POST as revokeDevice } from "../devices/[id]/revoke/route";

describe("v1 devices endpoints", () => {
  beforeEach(() => {
    authMocks.verifyUserToken.mockReset();
    authMocks.verifyExtensionToken.mockReset();
    userMocks.ensureUser.mockReset();
    userMocks.getUserById.mockReset();
    deviceMocks.claimDevice.mockReset();
    deviceMocks.listDevices.mockReset();
    dbMocks.db.device.findUnique.mockReset();
    dbMocks.db.device.update.mockReset();
    dbMocks.db.deviceSession.updateMany.mockReset();
  });

  it("claims a device via extension auth", async () => {
    authMocks.verifyExtensionToken.mockReturnValue({ sub: "user-1", iat: 0, exp: 999999 });
    userMocks.getUserById.mockResolvedValue({
      id: "user-1",
      email: "user@test.com",
      name: "Test User",
      imageUrl: null,
      createdAt: new Date("2026-01-01T00:00:00Z")
    });
    deviceMocks.claimDevice.mockResolvedValue({
      device: {
        id: "device-1",
        userId: "user-1",
        status: "ACTIVE",
        deviceName: "MacBook",
        os: "macOS",
        locale: "en-US",
        timezone: "UTC",
        browserName: "Chrome",
        browserVersion: "121",
        extensionVersion: "1.0.0",
        lastSeenAt: new Date("2026-02-02T00:00:00Z"),
        createdAt: new Date("2026-02-01T00:00:00Z"),
        updatedAt: new Date("2026-02-02T00:00:00Z")
      },
      session: {
        id: "session-1",
        deviceId: "device-1",
        userId: "user-1",
        createdAt: new Date("2026-02-02T00:00:00Z"),
        updatedAt: new Date("2026-02-02T00:00:00Z"),
        expiresAt: new Date("2026-03-03T00:00:00Z"),
        lastSeenAt: new Date("2026-02-02T00:00:00Z"),
        revokedAt: null
      },
      sessionTtlDays: 30
    });

    const response = await claimDevice(
      new Request("http://localhost/v1/devices/claim", {
        method: "POST",
        headers: { Authorization: "Bearer extension-token" },
        body: JSON.stringify({
          deviceId: "device-1",
          metadata: { os: "macOS", deviceName: "MacBook" }
        })
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.device.id).toBe("device-1");
    expect(payload.session.id).toBe("session-1");
    expect(payload.sessionTtlDays).toBe(30);
  });

  it("lists devices with latest session", async () => {
    authMocks.verifyUserToken.mockResolvedValue({ sub: "auth0|1" });
    userMocks.ensureUser.mockResolvedValue({ id: "user-1" });
    deviceMocks.listDevices.mockResolvedValue([
      {
        id: "device-1",
        userId: "user-1",
        status: "ACTIVE",
        deviceName: "MacBook",
        os: "macOS",
        locale: null,
        timezone: null,
        browserName: null,
        browserVersion: null,
        extensionVersion: null,
        lastSeenAt: null,
        createdAt: new Date("2026-02-01T00:00:00Z"),
        updatedAt: new Date("2026-02-02T00:00:00Z"),
        sessions: [
          {
            id: "session-1",
            deviceId: "device-1",
            userId: "user-1",
            createdAt: new Date("2026-02-02T00:00:00Z"),
            updatedAt: new Date("2026-02-02T00:00:00Z"),
            expiresAt: new Date("2026-03-03T00:00:00Z"),
            lastSeenAt: null,
            revokedAt: null
          }
        ]
      }
    ]);

    const response = await listDevices(
      new Request("http://localhost/v1/devices", {
        headers: { Authorization: "Bearer user-token" }
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.devices).toHaveLength(1);
    expect(payload.devices[0].session.id).toBe("session-1");
  });

  it("revokes a device and its active sessions", async () => {
    authMocks.verifyUserToken.mockResolvedValue({ sub: "auth0|1" });
    userMocks.ensureUser.mockResolvedValue({ id: "user-1" });
    dbMocks.db.device.findUnique.mockResolvedValue({
      id: "device-1",
      userId: "user-1",
      status: "ACTIVE",
      deviceName: null,
      os: null,
      locale: null,
      timezone: null,
      browserName: null,
      browserVersion: null,
      extensionVersion: null,
      lastSeenAt: null,
      createdAt: new Date("2026-02-01T00:00:00Z"),
      updatedAt: new Date("2026-02-02T00:00:00Z")
    });
    dbMocks.db.device.update.mockResolvedValue({
      id: "device-1",
      userId: "user-1",
      status: "REVOKED",
      deviceName: null,
      os: null,
      locale: null,
      timezone: null,
      browserName: null,
      browserVersion: null,
      extensionVersion: null,
      lastSeenAt: null,
      createdAt: new Date("2026-02-01T00:00:00Z"),
      updatedAt: new Date("2026-02-02T00:00:00Z")
    });

    const response = await revokeDevice(
      new Request("http://localhost/v1/devices/device-1/revoke", {
        method: "POST",
        headers: { Authorization: "Bearer user-token" }
      }),
      { params: Promise.resolve({ id: "device-1" }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status).toBe("REVOKED");
    expect(dbMocks.db.deviceSession.updateMany).toHaveBeenCalled();
  });
});
