import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";

vi.mock("@/src/env", () => ({
  env: {
    BETTER_AUTH_URL: "https://auth-primary.example.com",
    BETTER_AUTH_ALLOWED_ISSUERS: [
      " https://proxy-auth.example.com/ ",
      "https://auth-secondary.example.com",
    ],
  },
}));

import { verifyUserToken } from "../user-auth";

describe("verifyUserToken", () => {
  let privateKey: CryptoKey;
  let fetchCalls: string[] = [];

  beforeAll(async () => {
    const { publicKey, privateKey: generatedPrivate } =
      await generateKeyPair("RS256");
    privateKey = generatedPrivate;
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "user-auth-test-key";

    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      fetchCalls.push(url);

      if (!url.endsWith("/api/auth/jwks")) {
        return new Response("Not found", { status: 404 });
      }

      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
  });

  beforeEach(() => {
    fetchCalls = [];
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  async function signToken(
    issuer: string,
    subject: string | null = "user-123",
  ): Promise<string> {
    const jwt = new SignJWT({
      email: "alex@trail.net",
      name: "Alex Trail",
    })
      .setProtectedHeader({ alg: "RS256", kid: "user-auth-test-key" })
      .setIssuer(issuer)
      .setExpirationTime("2h");

    if (subject) {
      jwt.setSubject(subject);
    }

    return jwt.sign(privateKey);
  }

  it("rejects missing token", async () => {
    await expect(verifyUserToken(null)).resolves.toBeNull();
  });

  it("accepts token with primary issuer", async () => {
    const token = await signToken("https://auth-primary.example.com");
    const payload = await verifyUserToken(token);

    expect(payload?.sub).toBe("user-123");
    expect(fetchCalls.some((entry) =>
      entry.startsWith("https://auth-primary.example.com/api/auth/jwks"),
    )).toBe(true);
  });

  it("accepts token with allowlisted secondary issuer", async () => {
    const token = await signToken("https://auth-secondary.example.com");
    const payload = await verifyUserToken(token);

    expect(payload?.sub).toBe("user-123");
    expect(fetchCalls.some((entry) =>
      entry.startsWith("https://auth-secondary.example.com/api/auth/jwks"),
    )).toBe(true);
  });

  it("rejects token from unknown issuer even if signature is valid", async () => {
    const token = await signToken("https://unknown-issuer.example.com");
    await expect(verifyUserToken(token)).resolves.toBeNull();
  });

  it("rejects token without subject", async () => {
    const token = await signToken("https://auth-primary.example.com", null);
    await expect(verifyUserToken(token)).resolves.toBeNull();
  });
});
