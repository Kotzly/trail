import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  verifyExtensionToken: vi.fn(),
}));

const userMocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
}));

const snapshotMocks = vi.hoisted(() => ({
  listPlans: vi.fn(),
  buildAccountSnapshot: vi.fn(),
}));

vi.mock("@/src/server/auth/extension-auth", () => ({
  ...authMocks,
}));

vi.mock("@/src/server/user", () => ({
  ...userMocks,
}));

vi.mock("@/src/server/account-snapshot", () => ({
  ...snapshotMocks,
}));

import { GET as getPlans } from "../plans/route";
import { GET as getSubscription } from "../subscription/route";
import { GET as getBilling } from "../billing/route";
import { POST as checkout } from "../subscription/checkout/route";
import { POST as portal } from "../billing/portal/route";

describe("v1 billing endpoints", () => {
  beforeEach(() => {
    authMocks.verifyExtensionToken.mockReset();
    userMocks.getUserById.mockReset();
    snapshotMocks.listPlans.mockReset();
    snapshotMocks.buildAccountSnapshot.mockReset();
  });

  it("returns plans without auth", async () => {
    snapshotMocks.listPlans.mockReturnValue([
      {
        id: "free",
        name: "Free",
        tier: "free",
        priceMonthly: 0,
        priceYearly: 0,
        currency: "USD",
        features: [],
      },
    ]);

    const response = await getPlans(new Request("http://localhost/v1/plans"));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload[0].id).toBe("free");
  });

  it("returns subscription stub", async () => {
    authMocks.verifyExtensionToken.mockReturnValue({
      sub: "user-1",
      iat: 0,
      exp: 999999,
    });
    userMocks.getUserById.mockResolvedValue({
      id: "user-1",
      email: "user@test.com",
      name: "Test User",
      imageUrl: null,
      createdAt: new Date("2026-02-01T00:00:00Z"),
    });

    const response = await getSubscription(
      new Request("http://localhost/v1/subscription", {
        headers: { Authorization: "Bearer extension-token" },
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.planId).toBe("free");
  });

  it("returns billing status", async () => {
    authMocks.verifyExtensionToken.mockReturnValue({
      sub: "user-1",
      iat: 0,
      exp: 999999,
    });
    userMocks.getUserById.mockResolvedValue({
      id: "user-1",
      email: "user@test.com",
      name: "Test User",
      imageUrl: null,
      createdAt: new Date("2026-02-01T00:00:00Z"),
    });

    const response = await getBilling(
      new Request("http://localhost/v1/billing", {
        headers: { Authorization: "Bearer extension-token" },
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.state).toBe("none");
  });

  it("returns checkout link stub", async () => {
    authMocks.verifyExtensionToken.mockReturnValue({
      sub: "user-1",
      iat: 0,
      exp: 999999,
    });
    userMocks.getUserById.mockResolvedValue({
      id: "user-1",
      email: "user@test.com",
      name: "Test User",
      imageUrl: null,
      createdAt: new Date("2026-02-01T00:00:00Z"),
    });

    const response = await checkout(
      new Request("http://localhost/v1/subscription/checkout", {
        method: "POST",
        headers: { Authorization: "Bearer extension-token" },
        body: JSON.stringify({ planId: "pro", interval: "month" }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "");
    expect(payload.url).toBe(`${baseUrl}/billing`);
  });

  it("returns billing portal stub", async () => {
    authMocks.verifyExtensionToken.mockReturnValue({
      sub: "user-1",
      iat: 0,
      exp: 999999,
    });
    userMocks.getUserById.mockResolvedValue({
      id: "user-1",
      email: "user@test.com",
      name: "Test User",
      imageUrl: null,
      createdAt: new Date("2026-02-01T00:00:00Z"),
    });

    const response = await portal(
      new Request("http://localhost/v1/billing/portal", {
        method: "POST",
        headers: { Authorization: "Bearer extension-token" },
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "");
    expect(payload.url).toBe(`${baseUrl}/billing`);
  });
});
