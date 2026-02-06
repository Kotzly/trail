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

const accessMocks = vi.hoisted(() => ({
  getSubscriptionSnapshotForUser: vi.fn(),
}));

const billingProviderMocks = vi.hoisted(() => {
  const provider = {
    getBillingStatus: vi.fn(),
    createCheckoutSession: vi.fn(),
    createBillingPortalSession: vi.fn(),
  };
  class BillingProviderError extends Error {
    code: string;
    status: number;
    retryable?: boolean;
    details?: string;

    constructor(
      code: string,
      message: string,
      options: { status?: number; retryable?: boolean; details?: string } = {},
    ) {
      super(message);
      this.code = code;
      this.status = options.status ?? 500;
      this.retryable = options.retryable;
      this.details = options.details;
    }
  }
  return {
    getBillingProvider: vi.fn(() => provider),
    provider,
    BillingProviderError,
  };
});

vi.mock("@/src/server/auth/extension-auth", () => ({
  ...authMocks,
}));

vi.mock("@/src/server/user", () => ({
  ...userMocks,
}));

vi.mock("@/src/server/account-snapshot", () => ({
  ...snapshotMocks,
}));

vi.mock("@/src/server/subscription-access", () => ({
  ...accessMocks,
}));

vi.mock("@/src/env", () => ({
  env: {
    APP_BASE_URL: "http://localhost:3001",
    BETTER_AUTH_URL: "http://localhost:3003",
    TRAIL_INTERNAL_API_KEY: "test-internal-key",
    TRAIL_EXTENSION_JWT_SECRET: "test-extension-secret",
    BILLING_PROVIDER: "manual",
    NOWPAYMENTS_API_KEY: null,
    NOWPAYMENTS_IPN_SECRET: null,
    NOWPAYMENTS_API_BASE_URL: null,
  },
}));

vi.mock("@/src/server/billing/provider", () => ({
  ...billingProviderMocks,
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
    accessMocks.getSubscriptionSnapshotForUser.mockReset();
    billingProviderMocks.getBillingProvider.mockClear();
    billingProviderMocks.provider.getBillingStatus.mockReset();
    billingProviderMocks.provider.createCheckoutSession.mockReset();
    billingProviderMocks.provider.createBillingPortalSession.mockReset();
    accessMocks.getSubscriptionSnapshotForUser.mockResolvedValue({
      id: "sub_free",
      planId: "free",
      status: "active",
      interval: "month",
      currentPeriodStart: "2026-02-01T00:00:00.000Z",
      currentPeriodEnd: "2026-03-03T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      canceledAt: null,
    });
    billingProviderMocks.provider.getBillingStatus.mockResolvedValue({
      state: "none",
    });
    billingProviderMocks.provider.createCheckoutSession.mockResolvedValue({
      url: "https://billing.example.test/checkout",
      expiresAt: null,
    });
    billingProviderMocks.provider.createBillingPortalSession.mockResolvedValue({
      url: "https://billing.example.test/portal",
      expiresAt: null,
    });
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

  it("returns subscription snapshot", async () => {
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
    expect(billingProviderMocks.provider.getBillingStatus).toHaveBeenCalledWith({
      userId: "user-1",
      userEmail: "user@test.com",
    });
  });

  it("returns checkout link", async () => {
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
    expect(payload.url).toBe("https://billing.example.test/checkout");
    expect(billingProviderMocks.provider.createCheckoutSession).toHaveBeenCalledWith({
      userId: "user-1",
      userEmail: "user@test.com",
      planId: "pro",
      interval: "month",
      successUrl: undefined,
      cancelUrl: undefined,
    });
  });

  it("returns billing portal link", async () => {
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
    expect(payload.url).toBe("https://billing.example.test/portal");
    expect(
      billingProviderMocks.provider.createBillingPortalSession,
    ).toHaveBeenCalledWith({
      userId: "user-1",
      userEmail: "user@test.com",
    });
  });
});
