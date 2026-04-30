import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";

// ---------------------------------------------------------------------------
// Supabase fluent builder mock
// ---------------------------------------------------------------------------

type QueryResult = {
  data: unknown;
  error: null | { message: string; code?: string };
};

interface CallRecord {
  table: string;
  op: "select" | "update" | "upsert" | "insert" | "delete" | "unknown";
  args: unknown[];
}

const fluent = vi.hoisted(() => {
  const calls: CallRecord[] = [];
  const tableMocks: Record<string, () => QueryResult> = {};

  const defaultResult = (): QueryResult => ({ data: null, error: null });

  const ops = new Set(["select", "update", "upsert", "insert", "delete"]);
  const passthrough = [
    "select",
    "eq",
    "neq",
    "is",
    "not",
    "in",
    "gt",
    "lt",
    "gte",
    "lte",
    "or",
    "order",
    "limit",
    "maybeSingle",
    "single",
    "upsert",
    "insert",
    "update",
    "delete",
    "ignoreDuplicates",
  ] as const;

  function makeChain(table: string, result: QueryResult) {
    const current: CallRecord = { table, op: "unknown", args: [] };
    const chain: Record<string, unknown> = {};
    for (const m of passthrough) {
      chain[m] = (...args: unknown[]) => {
        if (ops.has(m)) {
          current.op = m as CallRecord["op"];
          current.args = args;
        }
        if (m === "maybeSingle" || m === "single") {
          return Promise.resolve(result);
        }
        return chain;
      };
    }
    chain.then = (
      resolve: (v: QueryResult) => unknown,
      reject: (e: unknown) => unknown,
    ) => {
      calls.push(current);
      return Promise.resolve(result).then(resolve, reject);
    };
    return chain;
  }

  const dbMock = {
    from: vi.fn((table: string) => {
      const factory = tableMocks[table];
      const result = factory ? factory() : defaultResult();
      return makeChain(table, result);
    }),
  };

  return { calls, tableMocks, dbMock };
});

const { calls, tableMocks, dbMock } = fluent;

vi.mock("@trail/db", () => ({ db: fluent.dbMock }));

vi.mock("@trail/db/helpers", () => ({
  maybeRow: <T>(res: QueryResult) => (res.data as T) ?? null,
}));

vi.mock("@/src/env", () => ({
  env: {
    appBaseUrl: "http://localhost:3001",
    TRAIL_EXTENSION_JWT_SECRET: "test-extension-secret",
    BILLING_PROVIDER: "nowpayments",
    NOWPAYMENTS_API_KEY: "key",
    NOWPAYMENTS_IPN_SECRET: "ipn-secret",
    NOWPAYMENTS_API_BASE_URL: "https://api.nowpayments.io",
  },
}));

import { POST } from "../billing/webhooks/nowpayments/route";

// ---------------------------------------------------------------------------
// HMAC helper (NOWPayments uses sorted-keys JSON serialization)
// ---------------------------------------------------------------------------

function sortObject(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortObject);
  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) result[key] = sortObject(obj[key]);
  return result;
}

function sig(payload: unknown, secret: string): string {
  const message = JSON.stringify(sortObject(payload));
  return createHmac("sha512", secret).update(message).digest("hex");
}

function setTable(table: string, result: QueryResult) {
  tableMocks[table] = () => result;
}

function setTableSeq(table: string, results: QueryResult[]) {
  let i = 0;
  tableMocks[table] = () => {
    const r = results[i] ?? results[results.length - 1];
    i++;
    return r;
  };
}

function postWebhook(payload: unknown, signature: string) {
  return POST(
    new Request("http://localhost/api/v1/billing/webhooks/nowpayments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nowpayments-sig": signature,
      },
      body: JSON.stringify(payload),
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("nowpayments webhook", () => {
  beforeEach(() => {
    dbMock.from.mockClear();
    calls.length = 0;
    for (const k of Object.keys(tableMocks)) delete tableMocks[k];
  });

  it("rejects invalid signature", async () => {
    const payload = { order_id: "order-1", payment_status: "finished" };
    const response = await postWebhook(payload, "deadbeef");
    expect(response.status).toBe(401);
    expect(dbMock.from).not.toHaveBeenCalled();
  });

  it("acknowledges unknown order ids without mutating subscriptions", async () => {
    const payload = { order_id: "order-unknown", payment_status: "finished" };
    setTable("billing_checkout_sessions", { data: null, error: null });

    const response = await postWebhook(payload, sig(payload, "ipn-secret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(
      calls.some((c) => c.table === "user_subscriptions" && c.op !== "select"),
    ).toBe(false);
  });

  it("upgrades subscription when payment is finished", async () => {
    const payload = {
      order_id: "order-1",
      payment_id: 123,
      payment_status: "finished",
    };

    // Sequence of billing_checkout_sessions queries:
    //   1) lookup existing session by order_id
    //   2) atomic claim: update WEBHOOK_RECEIVED + .select() (returns rows)
    //   3) duplicate-payment dedupe lookup → none
    //   4) final SUCCEEDED status update
    setTableSeq("billing_checkout_sessions", [
      {
        data: {
          order_id: "order-1",
          status: "PENDING",
          user_id: "user-1",
          plan_id: "pro",
          interval: "year",
          requested_interval: "year",
        },
        error: null,
      },
      { data: [{ order_id: "order-1" }], error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);

    // user_subscriptions: existing lookup → none, then upsert
    setTableSeq("user_subscriptions", [
      { data: null, error: null },
      { data: null, error: null },
    ]);

    const response = await postWebhook(payload, sig(payload, "ipn-secret"));

    expect(response.status).toBe(200);

    const upsertCall = calls.find(
      (c) => c.table === "user_subscriptions" && c.op === "upsert",
    );
    expect(upsertCall, "expected user_subscriptions.upsert").toBeDefined();
    const [row] = (upsertCall?.args ?? []) as [Record<string, unknown>];
    expect(row).toMatchObject({
      user_id: "user-1",
      plan: "PRO",
      status: "ACTIVE",
      cancel_at_period_end: false,
    });
  });
});
