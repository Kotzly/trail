import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  verifyExtensionToken: vi.fn(),
}));

const trailMocks = vi.hoisted(() => ({
  syncTrails: vi.fn(),
}));

const configMocks = vi.hoisted(() => ({
  getExtensionConfig: vi.fn(() => ({
    config: {
      "feature.trailsSync.minTier": "free",
    },
  })),
}));

const accessMocks = vi.hoisted(() => ({
  getFeatureAccessForUser: vi.fn(async () => ({
    allowed: true,
    currentTier: "free",
    requiredTier: "free",
  })),
}));

vi.mock("@/src/server/backend/auth/extension-auth", () => ({
  ...authMocks,
}));

vi.mock("@/src/server/backend/trails-sync", () => ({
  ...trailMocks,
}));

vi.mock("@/src/server/backend/extension-config", () => ({
  ...configMocks,
}));

vi.mock("@/src/server/backend/subscription-access", () => ({
  ...accessMocks,
}));

import { POST as sync } from "../trails/sync/route";

describe("v1 trails sync", () => {
  beforeEach(() => {
    authMocks.verifyExtensionToken.mockReset();
    trailMocks.syncTrails.mockReset();
    configMocks.getExtensionConfig.mockClear();
    accessMocks.getFeatureAccessForUser.mockClear();
    accessMocks.getFeatureAccessForUser.mockResolvedValue({
      allowed: true,
      currentTier: "free",
      requiredTier: "free",
    });
  });

  it("syncs trails for extension", async () => {
    authMocks.verifyExtensionToken.mockResolvedValue({
      sub: "user-1",
      iat: 0,
      exp: 999999,
    });
    trailMocks.syncTrails.mockResolvedValue({
      serverSyncAt: new Date("2026-02-03T00:00:00Z"),
      updates: [
        {
          id: "trail-1",
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
          payload: { a: 1 },
          deletedAt: null,
        },
      ],
    });

    const response = await sync(
      new Request("http://localhost/api/v1/trails/sync", {
        method: "POST",
        headers: { Authorization: "Bearer extension-token" },
        body: JSON.stringify({
          deviceId: "device-1",
          clientSyncAt: "2026-02-01T00:00:00Z",
          trails: [
            {
              id: "trail-1",
              deviceId: "device-1",
              label: "Trail 1",
              labelSource: "user",
              labelUpdatedAt: "2026-02-01T00:00:00Z",
              createdAt: "2026-02-01T00:00:00Z",
              updatedAt: "2026-02-01T00:00:00Z",
              savedAt: "2026-02-01T00:00:00Z",
              nodeCount: 2,
              rootUrl: null,
              rootTitle: null,
              rootFavicon: null,
              payload: { a: 1 },
              deletedAt: null,
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.serverSyncAt).toBe("2026-02-03T00:00:00.000Z");
    expect(payload.updates[0].labelSource).toBe("user");
    expect(accessMocks.getFeatureAccessForUser).toHaveBeenCalledWith({
      userId: "user-1",
      config: { "feature.trailsSync.minTier": "free" },
      featureKey: "trailsSync",
      fallbackMinTier: "free",
    });
  });

  it("returns 402 when trails sync is not allowed for current plan", async () => {
    authMocks.verifyExtensionToken.mockResolvedValue({
      sub: "user-1",
      iat: 0,
      exp: 999999,
    });
    accessMocks.getFeatureAccessForUser.mockResolvedValue({
      allowed: false,
      currentTier: "free",
      requiredTier: "pro",
    });

    const response = await sync(
      new Request("http://localhost/api/v1/trails/sync", {
        method: "POST",
        headers: { Authorization: "Bearer extension-token" },
        body: JSON.stringify({
          deviceId: "device-1",
          clientSyncAt: "2026-02-01T00:00:00Z",
          trails: [],
        }),
      }),
    );

    expect(response.status).toBe(402);
    const payload = await response.json();
    expect(payload.code).toBe("feature_locked");
    expect(payload.retryable).toBe(false);
    expect(trailMocks.syncTrails).not.toHaveBeenCalled();
  });

  it("returns 401 when token subject user does not exist", async () => {
    authMocks.verifyExtensionToken.mockResolvedValue({
      sub: "user-missing",
      iat: 0,
      exp: 999999,
    });
    trailMocks.syncTrails.mockRejectedValue(new Error("user_not_found"));

    const response = await sync(
      new Request("http://localhost/api/v1/trails/sync", {
        method: "POST",
        headers: { Authorization: "Bearer extension-token" },
        body: JSON.stringify({
          deviceId: "device-1",
          clientSyncAt: "2026-02-01T00:00:00Z",
          trails: [],
        }),
      }),
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.code).toBe("unauthorized");
    expect(payload.retryable).toBe(false);
  });
});
