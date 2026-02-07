/**
 * @vitest-environment node
 */
import { exportJWK, generateKeyPair, SignJWT } from "jose";

vi.mock("@/src/env", () => ({
  env: {
    TRAIL_AUTH_BASE_URL: "https://auth.example.com",
    ACCOUNT_AUTH_BYPASS: false,
  },
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
