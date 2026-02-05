import { beforeEach, describe, expect, it, vi } from "vitest";

const portalMocks = vi.hoisted(() => ({
  createPortalSession: vi.fn(),
  getPortalSessionStatus: vi.fn(),
  approvePortalSession: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  verifyUserToken: vi.fn(),
}));

const userMocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
}));

vi.mock("@/src/server/portal-sessions", () => ({
  ...portalMocks,
  PORTAL_POLL_INTERVAL_MS: 1500,
}));

vi.mock("@/src/server/auth/user-auth", () => ({
  ...authMocks,
}));

vi.mock("@/src/server/user", () => ({
  ...userMocks,
}));

import { POST as startPortal } from "../auth/portal/route";
import { GET as getPortalStatus } from "../auth/portal/[id]/route";
import { POST as approvePortal } from "../auth/portal/[id]/approve/route";

describe("auth portal flow", () => {
  beforeEach(() => {
    portalMocks.createPortalSession.mockReset();
    portalMocks.getPortalSessionStatus.mockReset();
    portalMocks.approvePortalSession.mockReset();
    authMocks.verifyUserToken.mockReset();
    userMocks.ensureUser.mockReset();
    process.env.APP_BASE_URL = "https://app.test";
  });

  it("starts a portal session", async () => {
    portalMocks.createPortalSession.mockResolvedValue({
      id: "portal-1",
      expiresAt: new Date("2026-02-02T00:00:00Z"),
      returnUrl: "chrome-extension://trail",
    });

    const response = await startPortal(
      new Request("http://localhost/v1/auth/portal", {
        method: "POST",
        body: JSON.stringify({ returnUrl: "chrome-extension://trail" }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.id).toBe("portal-1");
    expect(payload.url).toBe(
      "https://app.test/extension/confirm?portal=portal-1&returnUrl=chrome-extension%3A%2F%2Ftrail",
    );
    expect(payload.pollIntervalMs).toBe(1500);
  });

  it("returns pending status", async () => {
    portalMocks.getPortalSessionStatus.mockResolvedValue({
      status: "pending",
      session: { id: "portal-1" },
    });

    const response = await getPortalStatus(new Request("http://localhost"), {
      params: Promise.resolve({ id: "portal-1" }),
    });

    const payload = await response.json();
    expect(payload.status).toBe("pending");
  });

  it("approves a portal session", async () => {
    authMocks.verifyUserToken.mockResolvedValue({ sub: "auth0|1" });
    userMocks.ensureUser.mockResolvedValue({ id: "user-1" });
    portalMocks.approvePortalSession.mockResolvedValue({
      ok: true,
      session: { approvedAt: new Date("2026-02-02T01:00:00Z") },
    });

    const response = await approvePortal(
      new Request("http://localhost", {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      }),
      { params: Promise.resolve({ id: "portal-1" }) },
    );

    const payload = await response.json();
    expect(payload.status).toBe("approved");
    expect(payload.approvedAt).toBe("2026-02-02T01:00:00.000Z");
  });

  it("returns snapshot when approved", async () => {
    portalMocks.getPortalSessionStatus.mockResolvedValue({
      status: "approved",
      session: {
        id: "portal-1",
        extensionToken: "token-1",
        extensionTokenExpiresAt: new Date("2026-03-01T00:00:00Z"),
      },
      user: {
        id: "user-1",
        email: "user@test.com",
        name: "Test User",
        imageUrl: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const response = await getPortalStatus(new Request("http://localhost"), {
      params: Promise.resolve({ id: "portal-1" }),
    });

    const payload = await response.json();
    expect(payload.status).toBe("approved");
    expect(payload.snapshot.session.status).toBe("authenticated");
    expect(payload.snapshot.session.accessToken).toBe("token-1");
    expect(payload.snapshot.user.id).toBe("user-1");
  });
});
