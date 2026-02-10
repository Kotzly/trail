import { beforeEach, describe, expect, it, vi } from "vitest";

const connectMocks = vi.hoisted(() => ({
  createConnectSession: vi.fn(),
  getConnectSessionStatus: vi.fn(),
  approveConnectSession: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  verifyUserToken: vi.fn(),
  verifyExtensionToken: vi.fn(),
}));

const userMocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
}));

vi.mock("@/src/server/connect-sessions", () => ({
  ...connectMocks,
  CONNECT_POLL_INTERVAL_MS: 1500,
}));

vi.mock("@/src/server/auth/user-auth", () => ({
  ...authMocks,
}));

vi.mock("@/src/server/auth/extension-auth", () => ({
  ...authMocks,
}));

vi.mock("@/src/server/user", () => ({
  ...userMocks,
}));

import { POST as startConnect } from "../extension/connect/route";
import { GET as getConnect } from "../extension/connect/[id]/route";
import { POST as approveConnect } from "../extension/connect/[id]/approve/route";

describe("extension connect flow", () => {
  beforeEach(() => {
    connectMocks.createConnectSession.mockReset();
    connectMocks.getConnectSessionStatus.mockReset();
    connectMocks.approveConnectSession.mockReset();
    authMocks.verifyUserToken.mockReset();
    authMocks.verifyExtensionToken.mockReset();
    userMocks.ensureUser.mockReset();
  });

  it("starts a connect session", async () => {
    authMocks.verifyUserToken.mockResolvedValue({ sub: "auth|1" });
    userMocks.ensureUser.mockResolvedValue({ id: "user-1" });
    connectMocks.createConnectSession.mockResolvedValue({
      id: "connect-1",
      expiresAt: new Date("2026-02-02T00:00:00Z"),
    });

    const response = await startConnect(
      new Request("http://localhost/api/v1/extension/connect", {
        method: "POST",
        headers: { Authorization: "Bearer user-token" },
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.id).toBe("connect-1");
    expect(payload.pollIntervalMs).toBe(1500);
  });

  it("returns pending status", async () => {
    authMocks.verifyUserToken.mockResolvedValue({ sub: "auth|1" });
    userMocks.ensureUser.mockResolvedValue({ id: "user-1" });
    connectMocks.getConnectSessionStatus.mockResolvedValue({
      status: "pending",
      session: { id: "connect-1" },
    });

    const response = await getConnect(
      new Request("http://localhost/api/v1/extension/connect/connect-1", {
        headers: { Authorization: "Bearer user-token" },
      }),
      { params: Promise.resolve({ id: "connect-1" }) },
    );

    const payload = await response.json();
    expect(payload.status).toBe("pending");
  });

  it("approves connect session via extension", async () => {
    authMocks.verifyExtensionToken.mockReturnValue({
      sub: "user-1",
      iat: 0,
      exp: 1,
    });
    connectMocks.approveConnectSession.mockResolvedValue({
      ok: true,
      session: { approvedAt: new Date("2026-02-02T01:00:00Z") },
    });

    const response = await approveConnect(
      new Request("http://localhost/api/v1/extension/connect/connect-1/approve", {
        method: "POST",
        headers: { Authorization: "Bearer extension-token" },
      }),
      { params: Promise.resolve({ id: "connect-1" }) },
    );

    const payload = await response.json();
    expect(payload.status).toBe("approved");
    expect(payload.approvedAt).toBe("2026-02-02T01:00:00.000Z");
  });
});
