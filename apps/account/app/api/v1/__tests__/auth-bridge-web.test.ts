import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getAuthTokenFromCookies: vi.fn(),
}));

const bridgeMocks = vi.hoisted(() => ({
  createAuthBridgeCodeFromWebToken: vi.fn(),
}));

vi.mock("@/src/lib/auth", () => ({
  ...authMocks,
}));

vi.mock("@/src/server/backend/auth-bridge", () => ({
  ...bridgeMocks,
}));

import { POST } from "../auth/bridge/web/route";

describe("POST /api/v1/auth/bridge/web", () => {
  beforeEach(() => {
    authMocks.getAuthTokenFromCookies.mockReset();
    bridgeMocks.createAuthBridgeCodeFromWebToken.mockReset();
  });

  it("returns 401 when auth cookie is missing", async () => {
    authMocks.getAuthTokenFromCookies.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.code).toBe("unauthorized");
  });

  it("returns 401 when token is invalid", async () => {
    authMocks.getAuthTokenFromCookies.mockResolvedValue("bad-token");
    bridgeMocks.createAuthBridgeCodeFromWebToken.mockResolvedValue({
      ok: false,
      reason: "unauthorized",
    });

    const response = await POST();

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.code).toBe("unauthorized");
  });

  it("returns bridge code on success", async () => {
    authMocks.getAuthTokenFromCookies.mockResolvedValue("web-token");
    bridgeMocks.createAuthBridgeCodeFromWebToken.mockResolvedValue({
      ok: true,
      code: "bridge-code-2",
      expiresAt: new Date("2026-02-14T12:00:00.000Z"),
    });

    const response = await POST();

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.code).toBe("bridge-code-2");
    expect(payload.expiresAt).toBe("2026-02-14T12:00:00.000Z");
  });
});
