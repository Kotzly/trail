import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  verifyExtensionToken: vi.fn(),
}));

const userMocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
}));

const accessMocks = vi.hoisted(() => ({
  getSubscriptionSnapshotForUser: vi.fn(),
}));

vi.mock("@/src/server/auth/extension-auth", () => ({
  ...authMocks,
}));

vi.mock("@/src/server/user", () => ({
  ...userMocks,
}));

vi.mock("@/src/server/subscription-access", () => ({
  ...accessMocks,
}));

import { GET as getSubscription } from "../subscription/route";

describe("v1 subscription", () => {
  beforeEach(() => {
    authMocks.verifyExtensionToken.mockReset();
    userMocks.getUserById.mockReset();
    accessMocks.getSubscriptionSnapshotForUser.mockReset();
  });

  it("returns subscription snapshot for authorized extension user", async () => {
    authMocks.verifyExtensionToken.mockReturnValue({
      sub: "user-1",
      iat: 0,
      exp: 999999,
    });
    userMocks.getUserById.mockResolvedValue({
      id: "user-1",
      email: "user@test.com",
      name: "Test User",
      imageUrl: null,
      createdAt: new Date("2026-02-01T00:00:00Z"),
    });
    accessMocks.getSubscriptionSnapshotForUser.mockResolvedValue({
      id: "sub_1",
      planId: "pro",
      status: "active",
      interval: "month",
      currentPeriodStart: "2026-02-01T00:00:00.000Z",
      currentPeriodEnd: "2026-03-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      canceledAt: null,
    });

    const response = await getSubscription(
      new Request("http://localhost/v1/subscription", {
        headers: { Authorization: "Bearer extension-token" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "sub_1",
      planId: "pro",
      status: "active",
      interval: "month",
      currentPeriodStart: "2026-02-01T00:00:00.000Z",
      currentPeriodEnd: "2026-03-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      canceledAt: null,
    });
    expect(accessMocks.getSubscriptionSnapshotForUser).toHaveBeenCalledWith({
      userId: "user-1",
      fallbackCreatedAt: new Date("2026-02-01T00:00:00.000Z"),
    });
  });
});
