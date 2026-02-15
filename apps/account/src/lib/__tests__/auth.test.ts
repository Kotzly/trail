/**
 * @vitest-environment node
 */
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const extensionAuthMocks = vi.hoisted(() => ({
  verifyExtensionToken: vi.fn(async () => null as unknown),
}));

const userMocks = vi.hoisted(() => ({
  getUserById: vi.fn(async () => null as unknown),
}));

vi.mock("@/src/env", () => ({
  env: {
    appBaseUrl: "https://auth.example.com",
    ACCOUNT_AUTH_BYPASS: false,
  },
}));

vi.mock("@/src/server/backend/auth/extension-auth", () => ({
  ...extensionAuthMocks,
}));

vi.mock("@/src/server/backend/user", () => ({
  ...userMocks,
}));

const issuer = "https://auth.example.com";

import { getUserFromToken } from "../auth";

describe("getUserFromToken", () => {
  let privateKey: CryptoKey;
  let publicJwk: Awaited<ReturnType<typeof exportJWK>>;

  beforeAll(async () => {
    const { publicKey, privateKey: generatedPrivate } =
      await generateKeyPair("RS256");
    privateKey = generatedPrivate;
    publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "test-key";

    const jwks = { keys: [publicJwk] };
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (!url.startsWith(`${issuer}/api/auth/jwks`)) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(JSON.stringify(jwks), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    extensionAuthMocks.verifyExtensionToken.mockReset();
    userMocks.getUserById.mockReset();
    extensionAuthMocks.verifyExtensionToken.mockResolvedValue(null);
    userMocks.getUserById.mockResolvedValue(null);
  });

  it("returns the user for a valid token", async () => {
    const token = await new SignJWT({
      email: "alex@trail.net",
      name: "Alex Trail",
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer)
      .setSubject("uuid-dev-1234")
      .setExpirationTime("2h")
      .sign(privateKey);

    const user = await getUserFromToken(token);

    expect(user).toEqual({
      id: "uuid-dev-1234",
      email: "alex@trail.net",
      name: "Alex Trail",
      imageUrl: undefined,
    });
  });

  it("returns undefined when the issuer is invalid", async () => {
    const token = await new SignJWT({
      email: "alex@trail.net",
      name: "Alex Trail",
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer("https://evil.example.com")
      .setSubject("uuid-dev-1234")
      .setExpirationTime("2h")
      .sign(privateKey);

    await expect(getUserFromToken(token)).resolves.toBeUndefined();
  });

  it("falls back to extension token and resolves db user", async () => {
    extensionAuthMocks.verifyExtensionToken.mockResolvedValue({
      sub: "user-ext-1",
      iat: 100,
      exp: 200,
    } as unknown);
    userMocks.getUserById.mockResolvedValue({
      id: "user-ext-1",
      email: "ext@trail.net",
      name: "Extension User",
      imageUrl: "https://img.example.com/u.png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      onboardingSeenAt: null,
    } as unknown);

    const user = await getUserFromToken("invalid.jwt.token");

    expect(user).toEqual({
      id: "user-ext-1",
      email: "ext@trail.net",
      name: "Extension User",
      imageUrl: "https://img.example.com/u.png",
    });
  });

  it("returns undefined when extension token user does not exist", async () => {
    extensionAuthMocks.verifyExtensionToken.mockResolvedValue({
      sub: "user-ext-missing",
      iat: 100,
      exp: 200,
    } as unknown);
    userMocks.getUserById.mockResolvedValue(null as unknown);

    await expect(getUserFromToken("invalid.jwt.token")).resolves.toBeUndefined();
  });
});
