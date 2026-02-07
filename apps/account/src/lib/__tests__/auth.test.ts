/**
 * @vitest-environment node
 */
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import type { getUserFromToken as GetUserFromToken } from "../auth";

describe("getUserFromToken", () => {
  const issuer = "https://auth.example.com";
  const originalAuthBase = process.env.TRAIL_AUTH_BASE_URL;
  let privateKey: CryptoKey;
  let publicJwk: Awaited<ReturnType<typeof exportJWK>>;
  let getUserFromToken: typeof GetUserFromToken;

  beforeAll(async () => {
    process.env.TRAIL_AUTH_BASE_URL = issuer;
    vi.resetModules();
    ({ getUserFromToken } = await import("../auth"));
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
    if (originalAuthBase === undefined) {
      delete process.env.TRAIL_AUTH_BASE_URL;
    } else {
      process.env.TRAIL_AUTH_BASE_URL = originalAuthBase;
    }
    vi.unstubAllGlobals();
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
});
