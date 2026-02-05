import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  accountSettings: { findUnique: vi.fn() },
  device: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  deviceSession: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() }
}));

vi.mock("@trail/db", () => ({
  db: dbMocks
}));

import { claimDevice } from "../devices";

describe("claimDevice", () => {
  beforeEach(() => {
    dbMocks.accountSettings.findUnique.mockReset();
    dbMocks.device.findUnique.mockReset();
    dbMocks.device.update.mockReset();
    dbMocks.device.create.mockReset();
    dbMocks.deviceSession.findFirst.mockReset();
    dbMocks.deviceSession.update.mockReset();
    dbMocks.deviceSession.create.mockReset();
  });

  it("starts TTL lookup before device operations", async () => {
    const callOrder: string[] = [];

    dbMocks.accountSettings.findUnique.mockImplementation(async () => {
      callOrder.push("ttl");
      return { deviceSessionTtlDays: "DAYS_30" };
    });

    dbMocks.device.findUnique.mockImplementation(async () => {
      callOrder.push("device-find");
      return null;
    });

    dbMocks.device.create.mockImplementation(async () => {
      callOrder.push("device-create");
      return { id: "device-1" };
    });

    dbMocks.deviceSession.findFirst.mockImplementation(async () => {
      callOrder.push("session-find");
      return null;
    });

    dbMocks.deviceSession.create.mockImplementation(async () => {
      callOrder.push("session-create");
      return { id: "session-1", expiresAt: new Date(), lastSeenAt: new Date() };
    });

    await claimDevice({
      userId: "user-1",
      deviceId: "device-1",
      metadata: {}
    });

    expect(callOrder[0]).toBe("ttl");
    expect(callOrder.indexOf("ttl")).toBeLessThan(callOrder.indexOf("device-find"));
  });
});
