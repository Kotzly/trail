import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeAuthBridgeCode = vi.hoisted(() => vi.fn());

vi.mock("@/src/server/auth-bridge", () => ({
  exchangeAuthBridgeCode
}));

import { POST } from "../auth/bridge/exchange/route";

describe("POST /v1/auth/bridge/exchange", () => {
  beforeEach(() => {
    exchangeAuthBridgeCode.mockReset();
  });

  it("rejects missing code", async () => {
    const response = await POST(
      new Request("http://localhost/v1/auth/bridge/exchange", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.code).toBe("code_required");
  });

  it("returns 404 for invalid code", async () => {
    exchangeAuthBridgeCode.mockResolvedValue({ ok: false, reason: "not_found" });

    const response = await POST(
      new Request("http://localhost/v1/auth/bridge/exchange", {
        method: "POST",
        body: JSON.stringify({ code: "bad" })
      })
    );

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.code).toBe("code_invalid");
  });

  it("returns 404 for expired code", async () => {
    exchangeAuthBridgeCode.mockResolvedValue({ ok: false, reason: "expired" });

    const response = await POST(
      new Request("http://localhost/v1/auth/bridge/exchange", {
        method: "POST",
        body: JSON.stringify({ code: "expired" })
      })
    );

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.code).toBe("code_expired");
  });

  it("returns snapshot on success", async () => {
    exchangeAuthBridgeCode.mockResolvedValue({
      ok: true,
      jwt: "jwt-token",
      jwtExpiresAt: null,
      user: {
        id: "user-1",
        email: "user@test.com",
        name: "Test User",
        imageUrl: null,
        createdAt: new Date("2026-02-01T00:00:00Z")
      }
    });

    const response = await POST(
      new Request("http://localhost/v1/auth/bridge/exchange", {
        method: "POST",
        body: JSON.stringify({ code: "good" })
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.snapshot.session.status).toBe("authenticated");
    expect(payload.snapshot.session.accessToken).toBe("jwt-token");
    expect(payload.snapshot.user.id).toBe("user-1");
  });
});
