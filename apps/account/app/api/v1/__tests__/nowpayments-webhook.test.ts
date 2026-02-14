import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";

const dbMocks = vi.hoisted(() => ({
  db: {
    billingCheckoutSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userSubscription: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@trail/db", () => ({
  ...dbMocks,
}));

vi.mock("@/src/env", () => ({
  env: {
    APP_BASE_URL: "http://localhost:3001",
    BETTER_AUTH_URL: "http://localhost:3003",
    TRAIL_EXTENSION_JWT_SECRET: "test-extension-secret",
    BILLING_PROVIDER: "nowpayments",
    NOWPAYMENTS_API_KEY: "key",
    NOWPAYMENTS_IPN_SECRET: "ipn-secret",
    NOWPAYMENTS_API_BASE_URL: "https://api.nowpayments.io",
  },
}));

import { POST } from "../billing/webhooks/nowpayments/route";

function sortObject(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    result[key] = sortObject(obj[key]);
  }
  return result;
}

function sig(payload: unknown, secret: string): string {
  const message = JSON.stringify(sortObject(payload));
  return createHmac("sha512", secret).update(message).digest("hex");
}

describe("nowpayments webhook", () => {
  beforeEach(() => {
    dbMocks.db.billingCheckoutSession.findUnique.mockReset();
    dbMocks.db.billingCheckoutSession.update.mockReset();
    dbMocks.db.userSubscription.findUnique.mockReset();
    dbMocks.db.userSubscription.upsert.mockReset();
    dbMocks.db.userSubscription.update.mockReset();
  });

  it("rejects invalid signature", async () => {
    const payload = { order_id: "order-1", payment_status: "finished" };
    dbMocks.db.billingCheckoutSession.findUnique.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/v1/billing/webhooks/nowpayments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-nowpayments-sig": "deadbeef",
        },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("acknowledges unknown order ids", async () => {
    const payload = { order_id: "order-unknown", payment_status: "finished" };
    dbMocks.db.billingCheckoutSession.findUnique.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/v1/billing/webhooks/nowpayments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-nowpayments-sig": sig(payload, "ipn-secret"),
        },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("upgrades subscription when payment is finished", async () => {
    const payload = {
      order_id: "order-1",
      payment_id: 123,
      payment_status: "finished",
    };

    dbMocks.db.billingCheckoutSession.findUnique.mockResolvedValue({
      orderId: "order-1",
      userId: "user-1",
      planId: "pro",
      interval: "year",
      requestedInterval: "year",
    });
    dbMocks.db.billingCheckoutSession.update.mockResolvedValue({});
    dbMocks.db.userSubscription.findUnique.mockResolvedValue(null);
    dbMocks.db.userSubscription.upsert.mockResolvedValue({});

    const response = await POST(
      new Request("http://localhost/api/v1/billing/webhooks/nowpayments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-nowpayments-sig": sig(payload, "ipn-secret"),
        },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(200);
    expect(dbMocks.db.userSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        create: expect.objectContaining({
          userId: "user-1",
          plan: "PRO",
          status: "ACTIVE",
        }),
        update: expect.objectContaining({
          plan: "PRO",
          status: "ACTIVE",
        }),
      }),
    );
  });
});
