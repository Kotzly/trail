import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  trail: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@trail/db", () => ({
  db: dbMocks,
}));

import { syncTrails } from "../trails-sync";

describe("syncTrails", () => {
  beforeEach(() => {
    dbMocks.trail.deleteMany.mockReset();
    dbMocks.trail.findMany.mockReset();
    dbMocks.trail.update.mockReset();
    dbMocks.trail.create.mockReset();
    dbMocks.$transaction.mockReset();
  });

  it("batches trail writes in a transaction", async () => {
    const existingTrail = {
      id: "trail-1",
      userId: "user-1",
      deviceId: "device-1",
      label: "Server",
      labelSource: "USER",
      labelUpdatedAt: new Date("2026-01-01T00:00:00Z"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      savedAt: new Date("2026-01-01T00:00:00Z"),
      nodeCount: 1,
      rootUrl: null,
      rootTitle: null,
      rootFavicon: null,
      payload: {},
      deletedAt: null,
    };

    dbMocks.trail.deleteMany.mockResolvedValue({ count: 0 });
    dbMocks.trail.findMany
      .mockResolvedValueOnce([existingTrail])
      .mockResolvedValueOnce([]);
    dbMocks.trail.update.mockResolvedValue(existingTrail);
    dbMocks.trail.create.mockResolvedValue({ ...existingTrail, id: "trail-2" });
    dbMocks.$transaction.mockImplementation(async (ops) => Promise.all(ops));

    await syncTrails({
      userId: "user-1",
      deviceId: "device-1",
      clientSyncAt: new Date("2026-02-01T00:00:00Z"),
      trails: [
        {
          id: "trail-1",
          deviceId: "device-1",
          label: "Client",
          labelSource: "USER",
          labelUpdatedAt: new Date("2026-02-01T00:00:00Z"),
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-02-01T00:00:00Z"),
          savedAt: new Date("2026-02-01T00:00:00Z"),
          nodeCount: 2,
          rootUrl: null,
          rootTitle: null,
          rootFavicon: null,
          payload: { v: 1 },
          deletedAt: null,
        },
        {
          id: "trail-2",
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
          payload: { v: 2 },
          deletedAt: null,
        },
      ],
    });

    expect(dbMocks.$transaction).toHaveBeenCalledTimes(1);
    expect(dbMocks.$transaction).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(Promise), expect.any(Promise)]),
    );
  });

  it("creates new trails with client-provided id", async () => {
    dbMocks.trail.deleteMany.mockResolvedValue({ count: 0 });
    dbMocks.trail.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    dbMocks.trail.create.mockResolvedValue({
      id: "trail-client-id",
      userId: "user-1",
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
    });
    dbMocks.$transaction.mockImplementation(async (ops) => Promise.all(ops));

    await syncTrails({
      userId: "user-1",
      deviceId: "device-1",
      clientSyncAt: new Date("2026-02-01T00:00:00Z"),
      trails: [
        {
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
      ],
    });

    expect(dbMocks.trail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: "trail-client-id",
        }),
      }),
    );
  });
});
