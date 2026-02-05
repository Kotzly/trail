import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  verifyExtensionToken: vi.fn(),
}));

const trailMocks = vi.hoisted(() => ({
  syncTrails: vi.fn(),
}));

vi.mock("@/src/server/auth/extension-auth", () => ({
  ...authMocks,
}));

vi.mock("@/src/server/trails-sync", () => ({
  ...trailMocks,
}));

import { POST as sync } from "../trails/sync/route";

describe("v1 trails sync", () => {
  beforeEach(() => {
    authMocks.verifyExtensionToken.mockReset();
    trailMocks.syncTrails.mockReset();
  });

  it("syncs trails for extension", async () => {
    authMocks.verifyExtensionToken.mockReturnValue({
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
      new Request("http://localhost/v1/trails/sync", {
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
  });
});
