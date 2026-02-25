import { beforeEach, describe, expect, it, vi } from "vitest";

const txMocks = vi.hoisted(() => ({
  trail: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));

const dbMocks = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  device: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
  },
  trail: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@trail/db", () => ({
  db: dbMocks,
}));

import { upsertTrail } from "../trails-sync";

function setupUserAndDevice(userId = "user-1", deviceId = "device-1") {
  dbMocks.user.findUnique.mockResolvedValue({ id: userId });
  dbMocks.device.findMany.mockResolvedValue([
    { id: deviceId, userId },
  ]);
  dbMocks.device.createMany.mockResolvedValue({ count: 0 });
  dbMocks.device.update.mockResolvedValue({
    id: deviceId,
    userId,
    status: "ACTIVE",
  });
}

describe("upsertTrail", () => {
  beforeEach(() => {
    dbMocks.user.findUnique.mockReset();
    dbMocks.device.findMany.mockReset();
    dbMocks.device.createMany.mockReset();
    dbMocks.device.update.mockReset();
    dbMocks.trail.deleteMany.mockReset();
    dbMocks.trail.findMany.mockReset();
    dbMocks.$transaction.mockReset();
    txMocks.trail.findFirst.mockReset();
    txMocks.trail.update.mockReset();
    txMocks.trail.create.mockReset();
  });

  it("runs trail upsert inside a $transaction", async () => {
    setupUserAndDevice();
    dbMocks.$transaction.mockImplementation(async (fn: (tx: typeof txMocks) => Promise<unknown>) => fn(txMocks));
    txMocks.trail.findFirst.mockResolvedValue(null);
    const created = {
      id: "trail-1",
      userId: "user-1",
      deviceId: "device-1",
      updatedAt: new Date("2026-02-01T00:00:00Z"),
    };
    txMocks.trail.create.mockResolvedValue(created);

    const result = await upsertTrail({
      userId: "user-1",
      deviceId: "device-1",
      trail: {
        id: "trail-1",
        deviceId: "device-1",
        label: "New",
        labelSource: "USER",
        labelUpdatedAt: new Date("2026-02-01T00:00:00Z"),
        createdAt: new Date("2026-02-01T00:00:00Z"),
        updatedAt: new Date("2026-02-01T00:00:00Z"),
        savedAt: new Date("2026-02-01T00:00:00Z"),
        nodeCount: 1,
        rootUrl: null,
        rootTitle: null,
        rootFavicon: null,
        payload: { v: 1 },
        deletedAt: null,
      },
    });

    expect(dbMocks.$transaction).toHaveBeenCalledTimes(1);
    expect(result.applied).toBe(true);
  });

  it("creates new trail with client-provided id", async () => {
    setupUserAndDevice();
    dbMocks.$transaction.mockImplementation(async (fn: (tx: typeof txMocks) => Promise<unknown>) => fn(txMocks));
    txMocks.trail.findFirst.mockResolvedValue(null);
    txMocks.trail.create.mockResolvedValue({
      id: "trail-client-id",
      userId: "user-1",
      deviceId: "device-1",
      updatedAt: new Date("2026-02-01T00:00:00Z"),
    });

    await upsertTrail({
      userId: "user-1",
      deviceId: "device-1",
      trail: {
        id: "trail-client-id",
        deviceId: "device-1",
        label: "New",
        labelSource: "USER",
        labelUpdatedAt: new Date("2026-02-01T00:00:00Z"),
        createdAt: new Date("2026-02-01T00:00:00Z"),
        updatedAt: new Date("2026-02-01T00:00:00Z"),
        savedAt: new Date("2026-02-01T00:00:00Z"),
        nodeCount: 1,
        rootUrl: null,
        rootTitle: null,
        rootFavicon: null,
        payload: { v: 1 },
        deletedAt: null,
      },
    });

    expect(txMocks.trail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: "trail-client-id",
        }),
      }),
    );
  });

  it("creates missing device before trail upsert", async () => {
    dbMocks.user.findUnique.mockResolvedValue({ id: "user-1" });
    dbMocks.device.findMany.mockResolvedValue([]);
    dbMocks.device.createMany.mockResolvedValue({ count: 1 });
    dbMocks.device.update.mockResolvedValue({
      id: "device-new",
      userId: "user-1",
      status: "ACTIVE",
    });
    dbMocks.$transaction.mockImplementation(async (fn: (tx: typeof txMocks) => Promise<unknown>) => fn(txMocks));
    txMocks.trail.findFirst.mockResolvedValue(null);
    txMocks.trail.create.mockResolvedValue({
      id: "trail-new",
      userId: "user-1",
      deviceId: "device-new",
      updatedAt: new Date("2026-02-01T00:00:00Z"),
    });

    await upsertTrail({
      userId: "user-1",
      deviceId: "device-new",
      trail: {
        id: "trail-new",
        deviceId: "device-new",
        label: "New",
        labelSource: "USER",
        labelUpdatedAt: new Date("2026-02-01T00:00:00Z"),
        createdAt: new Date("2026-02-01T00:00:00Z"),
        updatedAt: new Date("2026-02-01T00:00:00Z"),
        savedAt: new Date("2026-02-01T00:00:00Z"),
        nodeCount: 1,
        rootUrl: null,
        rootTitle: null,
        rootFavicon: null,
        payload: { v: 1 },
        deletedAt: null,
      },
    });

    expect(dbMocks.device.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: "device-new",
            userId: "user-1",
          }),
        ]),
      }),
    );
  });

  it("throws user_not_found when user does not exist", async () => {
    dbMocks.user.findUnique.mockResolvedValue(null);

    await expect(
      upsertTrail({
        userId: "user-missing",
        deviceId: "device-1",
        trail: {
          id: "trail-1",
          deviceId: "device-1",
          label: "Test",
          labelSource: "USER",
          labelUpdatedAt: new Date("2026-02-01T00:00:00Z"),
          createdAt: new Date("2026-02-01T00:00:00Z"),
          updatedAt: new Date("2026-02-01T00:00:00Z"),
          savedAt: new Date("2026-02-01T00:00:00Z"),
          nodeCount: 1,
          payload: {},
        },
      }),
    ).rejects.toThrowError("user_not_found");

    expect(dbMocks.device.findMany).not.toHaveBeenCalled();
  });
});
