import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  verifyExtensionToken: vi.fn(),
}));

const userMocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
}));

const snapshotMocks = vi.hoisted(() => ({
  buildAccountSnapshot: vi.fn(),
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

vi.mock("@/src/server/account-snapshot", () => ({
  ...snapshotMocks,
}));

vi.mock("@/src/server/subscription-access", () => ({
  ...accessMocks,
}));

import { GET as getAccount } from "../account/route";

describe("v1 account snapshot", () => {
  beforeEach(() => {
    authMocks.verifyExtensionToken.mockReset();
    userMocks.getUserById.mockReset();
    snapshotMocks.buildAccountSnapshot.mockReset();
    accessMocks.getSubscriptionSnapshotForUser.mockReset();
    accessMocks.getSubscriptionSnapshotForUser.mockResolvedValue(null);
  });

  it("returns snapshot for extension user", async () => {
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
    snapshotMocks.buildAccountSnapshot.mockReturnValue({
      session: {
        status: "authenticated",
        accessToken: "token-1",
        expiresAt: null,
      },
      user: {
        id: "user-1",
        email: "user@test.com",
        displayName: "Test User",
        avatarUrl: null,
        createdAt: "2026-02-01T00:00:00.000Z",
      },
      subscription: null,
      billing: { state: "none" },
      plans: [],
      config: {},
    });

    const response = await getAccount(
      new Request("http://localhost/api/v1/account", {
        headers: { Authorization: "Bearer extension-token" },
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.session.status).toBe("authenticated");
    expect(payload.user.id).toBe("user-1");
  });
});
