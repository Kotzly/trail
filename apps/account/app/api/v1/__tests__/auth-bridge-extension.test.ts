import { beforeEach, describe, expect, it, vi } from "vitest";

const bridgeMocks = vi.hoisted(() => ({
  createAuthBridgeCodeFromExtensionToken: vi.fn(),
}));

vi.mock("@/src/server/backend/auth-bridge", () => ({
  ...bridgeMocks,
}));

import { POST } from "../auth/bridge/extension/route";

describe("POST /api/v1/auth/bridge/extension", () => {
  beforeEach(() => {
    bridgeMocks.createAuthBridgeCodeFromExtensionToken.mockReset();
  });

  it("returns 401 when bearer token is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/auth/bridge/extension", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.code).toBe("unauthorized");
  });

  it("returns 401 when token is invalid", async () => {
    bridgeMocks.createAuthBridgeCodeFromExtensionToken.mockResolvedValue({
      ok: false,
      reason: "unauthorized",
    });

    const response = await POST(
      new Request("http://localhost/api/v1/auth/bridge/extension", {
        method: "POST",
        headers: {
          Authorization: "Bearer invalid-token",
        },
      }),
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.code).toBe("unauthorized");
  });

  it("returns 404 when token user does not exist", async () => {
    bridgeMocks.createAuthBridgeCodeFromExtensionToken.mockResolvedValue({
      ok: false,
      reason: "user_not_found",
    });

    const response = await POST(
      new Request("http://localhost/api/v1/auth/bridge/extension", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-extension-token",
        },
      }),
    );

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.code).toBe("user_not_found");
  });

  it("returns bridge code on success", async () => {
    bridgeMocks.createAuthBridgeCodeFromExtensionToken.mockResolvedValue({
      ok: true,
      code: "bridge-code-1",
      expiresAt: new Date("2026-02-14T12:00:00.000Z"),
    });

    const response = await POST(
      new Request("http://localhost/api/v1/auth/bridge/extension", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-extension-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.code).toBe("bridge-code-1");
    expect(payload.expiresAt).toBe("2026-02-14T12:00:00.000Z");
  });
});
