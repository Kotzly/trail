import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  verifyUserToken: vi.fn(),
}));

const userMocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  db: {
    trail: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/src/server/auth/user-auth", () => ({
  ...authMocks,
}));

vi.mock("@/src/server/user", () => ({
  ...userMocks,
}));

vi.mock("@trail/db", () => ({
  ...dbMocks,
}));

import { GET as listTrails } from "../trails/route";
import {
  PATCH as updateTrail,
  DELETE as deleteTrail,
} from "../trails/[id]/route";
import { POST as restoreTrail } from "../trails/[id]/restore/route";

describe("v1 trails endpoints", () => {
  beforeEach(() => {
    authMocks.verifyUserToken.mockReset();
    userMocks.ensureUser.mockReset();
    dbMocks.db.trail.findMany.mockReset();
    dbMocks.db.trail.findFirst.mockReset();
    dbMocks.db.trail.update.mockReset();
  });

  it("lists trails with pagination", async () => {
    authMocks.verifyUserToken.mockResolvedValue({ sub: "user-1" });
    userMocks.ensureUser.mockResolvedValue({ id: "user-1" });
    dbMocks.db.trail.findMany.mockResolvedValue([
      {
        id: "trail-1",
        userId: "user-1",
        deviceId: "device-1",
        label: "Trail 1",
        labelSource: "USER",
        labelUpdatedAt: new Date("2026-02-01T00:00:00Z"),
        createdAt: new Date("2026-02-01T00:00:00Z"),
        updatedAt: new Date("2026-02-02T00:00:00Z"),
        savedAt: new Date("2026-02-02T00:00:00Z"),
        nodeCount: 2,
        rootUrl: null,
        rootTitle: null,
        rootFavicon: null,
        deletedAt: null,
      },
      {
        id: "trail-2",
        userId: "user-1",
        deviceId: "device-1",
        label: "Trail 2",
        labelSource: "USER",
        labelUpdatedAt: new Date("2026-02-01T00:00:00Z"),
        createdAt: new Date("2026-02-01T00:00:00Z"),
        updatedAt: new Date("2026-02-01T00:00:00Z"),
        savedAt: new Date("2026-02-01T00:00:00Z"),
        nodeCount: 1,
        rootUrl: null,
        rootTitle: null,
        rootFavicon: null,
        deletedAt: null,
      },
    ]);

    const response = await listTrails(
      new Request("http://localhost/v1/trails?limit=1", {
        headers: { Authorization: "Bearer user-token" },
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.items).toHaveLength(1);
    expect(payload.nextCursor).toBe("2026-02-01T00:00:00.000Z");
  });

  it("updates trail metadata", async () => {
    authMocks.verifyUserToken.mockResolvedValue({ sub: "user-1" });
    userMocks.ensureUser.mockResolvedValue({ id: "user-1" });
    dbMocks.db.trail.findFirst.mockResolvedValue({
      id: "trail-1",
      userId: "user-1",
    });
    dbMocks.db.trail.update.mockResolvedValue({
      id: "trail-1",
      userId: "user-1",
      deviceId: "device-1",
      label: "Updated",
      labelSource: "USER",
      labelUpdatedAt: new Date("2026-02-02T00:00:00Z"),
      createdAt: new Date("2026-02-01T00:00:00Z"),
      updatedAt: new Date("2026-02-02T00:00:00Z"),
      savedAt: new Date("2026-02-01T00:00:00Z"),
      nodeCount: 2,
      rootUrl: null,
      rootTitle: null,
      rootFavicon: null,
      payload: { a: 1 },
      deletedAt: null,
    });

    const response = await updateTrail(
      new Request("http://localhost/v1/trails/trail-1", {
        method: "PATCH",
        headers: { Authorization: "Bearer user-token" },
        body: JSON.stringify({ label: "Updated", labelSource: "user" }),
      }),
      { params: Promise.resolve({ id: "trail-1" }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.label).toBe("Updated");
    expect(payload.labelSource).toBe("user");
  });

  it("soft deletes a trail", async () => {
    authMocks.verifyUserToken.mockResolvedValue({ sub: "user-1" });
    userMocks.ensureUser.mockResolvedValue({ id: "user-1" });
    dbMocks.db.trail.findFirst.mockResolvedValue({
      id: "trail-1",
      userId: "user-1",
    });
    dbMocks.db.trail.update.mockResolvedValue({
      id: "trail-1",
      userId: "user-1",
      deviceId: "device-1",
      label: "Trail",
      labelSource: "USER",
      labelUpdatedAt: new Date("2026-02-01T00:00:00Z"),
      createdAt: new Date("2026-02-01T00:00:00Z"),
      updatedAt: new Date("2026-02-02T00:00:00Z"),
      savedAt: new Date("2026-02-01T00:00:00Z"),
      nodeCount: 2,
      rootUrl: null,
      rootTitle: null,
      rootFavicon: null,
      payload: { a: 1 },
      deletedAt: new Date("2026-02-02T00:00:00Z"),
    });

    const response = await deleteTrail(
      new Request("http://localhost/v1/trails/trail-1", {
        method: "DELETE",
        headers: { Authorization: "Bearer user-token" },
      }),
      { params: Promise.resolve({ id: "trail-1" }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.deletedAt).toBe("2026-02-02T00:00:00.000Z");
  });

  it("restores a trail", async () => {
    authMocks.verifyUserToken.mockResolvedValue({ sub: "user-1" });
    userMocks.ensureUser.mockResolvedValue({ id: "user-1" });
    dbMocks.db.trail.findFirst.mockResolvedValue({
      id: "trail-1",
      userId: "user-1",
    });
    dbMocks.db.trail.update.mockResolvedValue({
      id: "trail-1",
      userId: "user-1",
      deviceId: "device-1",
      label: "Trail",
      labelSource: "USER",
      labelUpdatedAt: new Date("2026-02-01T00:00:00Z"),
      createdAt: new Date("2026-02-01T00:00:00Z"),
      updatedAt: new Date("2026-02-02T00:00:00Z"),
      savedAt: new Date("2026-02-01T00:00:00Z"),
      nodeCount: 2,
      rootUrl: null,
      rootTitle: null,
      rootFavicon: null,
      payload: { a: 1 },
      deletedAt: null,
    });

    const response = await restoreTrail(
      new Request("http://localhost/v1/trails/trail-1/restore", {
        method: "POST",
        headers: { Authorization: "Bearer user-token" },
      }),
      { params: Promise.resolve({ id: "trail-1" }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.deletedAt).toBe(null);
  });
});
