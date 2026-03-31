/**
 * @vitest-environment node
 */

const extensionAuthMocks = vi.hoisted(() => ({
  verifyExtensionToken: vi.fn(async () => null as unknown),
}));

const userMocks = vi.hoisted(() => ({
  getUserById: vi.fn(async () => null as unknown),
}));

vi.mock("@/src/server/backend/auth/extension-auth", () => ({
  ...extensionAuthMocks,
}));

vi.mock("@/src/server/backend/user", () => ({
  ...userMocks,
}));

import { getUserFromToken } from "../auth";

describe("getUserFromToken", () => {
  beforeEach(() => {
    extensionAuthMocks.verifyExtensionToken.mockReset();
    userMocks.getUserById.mockReset();
    extensionAuthMocks.verifyExtensionToken.mockResolvedValue(null);
    userMocks.getUserById.mockResolvedValue(null);
  });

  it("returns undefined for empty token", async () => {
    await expect(getUserFromToken("")).resolves.toBeUndefined();
  });

  it("returns undefined when extension token is invalid", async () => {
    extensionAuthMocks.verifyExtensionToken.mockResolvedValue(null);

    await expect(getUserFromToken("invalid.token")).resolves.toBeUndefined();
  });

  it("resolves user from valid extension token", async () => {
    extensionAuthMocks.verifyExtensionToken.mockResolvedValue({
      sub: "user-ext-1",
      iat: 100,
      exp: 200,
      sid: "session-1",
      ver: 1,
    });
    userMocks.getUserById.mockResolvedValue({
      id: "user-ext-1",
      email: "ext@trail.net",
      name: "Extension User",
      imageUrl: "https://img.example.com/u.png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      onboardingSeenAt: null,
    });

    const user = await getUserFromToken("valid.extension.token");

    expect(user).toEqual({
      id: "user-ext-1",
      email: "ext@trail.net",
      name: "Extension User",
      imageUrl: "https://img.example.com/u.png",
    });
  });

  it("returns undefined when extension token user does not exist in db", async () => {
    extensionAuthMocks.verifyExtensionToken.mockResolvedValue({
      sub: "user-ext-missing",
      iat: 100,
      exp: 200,
    });
    userMocks.getUserById.mockResolvedValue(null);

    await expect(getUserFromToken("valid.ext.token")).resolves.toBeUndefined();
  });
});
