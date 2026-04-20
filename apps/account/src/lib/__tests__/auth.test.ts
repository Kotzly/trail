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

// Test the consolidated getAuthenticatedUser — previously this file
// tested getUserFromToken (src/lib/auth.ts) which was one of three
// bearer-token resolvers. All three were consolidated into
// get-authenticated-user.ts in Phase A6.
import {
  getAuthenticatedUser,
  getAuthenticatedUserId,
} from "@/src/server/auth/get-authenticated-user";

describe("getAuthenticatedUser", () => {
  beforeEach(() => {
    extensionAuthMocks.verifyExtensionToken.mockReset();
    userMocks.getUserById.mockReset();
    extensionAuthMocks.verifyExtensionToken.mockResolvedValue(null);
    userMocks.getUserById.mockResolvedValue(null);
  });

  it("returns null for empty token", async () => {
    await expect(getAuthenticatedUser("")).resolves.toBeNull();
    await expect(getAuthenticatedUser(null)).resolves.toBeNull();
    await expect(getAuthenticatedUser(undefined)).resolves.toBeNull();
  });

  it("returns null when extension token is invalid", async () => {
    extensionAuthMocks.verifyExtensionToken.mockResolvedValue(null);
    await expect(getAuthenticatedUser("invalid.token")).resolves.toBeNull();
  });

  it("resolves user from valid extension token", async () => {
    extensionAuthMocks.verifyExtensionToken.mockResolvedValue({
      sub: "user-ext-1",
      iat: 100,
      exp: 200,
      sid: "session-1",
      ver: 1,
    });
    const dbUser = {
      id: "user-ext-1",
      email: "ext@trail.net",
      name: "Extension User",
      imageUrl: "https://img.example.com/u.png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      onboardingSeenAt: null,
    };
    userMocks.getUserById.mockResolvedValue(dbUser);

    const user = await getAuthenticatedUser("valid.extension.token");
    expect(user).toEqual(dbUser);
  });

  it("returns null when extension token user does not exist in db", async () => {
    extensionAuthMocks.verifyExtensionToken.mockResolvedValue({
      sub: "user-ext-missing",
      iat: 100,
      exp: 200,
    });
    userMocks.getUserById.mockResolvedValue(null);
    await expect(getAuthenticatedUser("valid.ext.token")).resolves.toBeNull();
  });

  it("refuses internal:<uuid> tokens by default", async () => {
    // Without allowInternal, the internal-prefix token is treated as a
    // regular bearer token, fails JWT verify (because it isn't one),
    // and returns null.
    extensionAuthMocks.verifyExtensionToken.mockResolvedValue(null);
    await expect(getAuthenticatedUser("internal:abc-123")).resolves.toBeNull();
    expect(extensionAuthMocks.verifyExtensionToken).toHaveBeenCalledOnce();
  });

  it("resolves internal:<uuid> when allowInternal is set", async () => {
    const dbUser = {
      id: "abc-123",
      email: "x@example.com",
      name: "X",
      imageUrl: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      onboardingSeenAt: null,
    };
    userMocks.getUserById.mockResolvedValue(dbUser);

    const user = await getAuthenticatedUser("internal:abc-123", {
      allowInternal: true,
    });
    expect(user).toEqual(dbUser);
    // In the internal-prefix path, verifyExtensionToken is not called.
    expect(extensionAuthMocks.verifyExtensionToken).not.toHaveBeenCalled();
  });
});

describe("getAuthenticatedUserId", () => {
  beforeEach(() => {
    extensionAuthMocks.verifyExtensionToken.mockReset();
    userMocks.getUserById.mockReset();
  });

  it("returns just the user id", async () => {
    extensionAuthMocks.verifyExtensionToken.mockResolvedValue({
      sub: "user-1",
      iat: 0,
      exp: 1,
    });
    userMocks.getUserById.mockResolvedValue({
      id: "user-1",
      email: null,
      name: null,
      imageUrl: null,
      createdAt: new Date(0),
      onboardingSeenAt: null,
    });
    await expect(getAuthenticatedUserId("tok")).resolves.toBe("user-1");
  });

  it("returns null when user is null", async () => {
    userMocks.getUserById.mockResolvedValue(null);
    await expect(getAuthenticatedUserId("tok")).resolves.toBeNull();
  });
});
