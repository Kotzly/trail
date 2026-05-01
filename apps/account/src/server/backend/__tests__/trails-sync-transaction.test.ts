import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Supabase chainable query builder mock
// ---------------------------------------------------------------------------

type QueryResult = {
  data: unknown;
  error: null | { message: string; code?: string };
  count?: number | null;
};

function makeChain(result: QueryResult) {
  const chain: Record<string, unknown> = {};
  const methods = [
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
  ];
  for (const m of methods) {
    chain[m] = (..._args: unknown[]) => {
      if (m === "maybeSingle" || m === "single") {
        return Promise.resolve(result);
      }
      return chain;
    };
  }
  // thenable so `await db.from(...).select(...)` works
  chain.then = (
    resolve: (v: QueryResult) => unknown,
    reject: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

// Per-table mock factories — tests can override these
const tableMocks: Record<string, () => QueryResult> = {};

function defaultResult(): QueryResult {
  return { data: null, error: null };
}

const rpcMock = vi.fn(
  async (_name: string, _args?: unknown): Promise<QueryResult> => ({
    data: null,
    error: null,
  }),
);

const dbMock = {
  from: vi.fn((table: string) => {
    const factory = tableMocks[table];
    const result = factory ? factory() : defaultResult();
    const chain = makeChain(result);
    (chain as Record<string, unknown>).from = dbMock.from;
    return chain;
  }),
  rpc: rpcMock,
};

vi.mock("@trail/db", () => ({
  db: dbMock,
}));

import { upsertTrail } from "../trails-sync";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setTable(table: string, result: QueryResult) {
  tableMocks[table] = () => result;
}

function setTableSeq(table: string, results: QueryResult[]) {
  let idx = 0;
  tableMocks[table] = () => {
    const r = results[idx] ?? results[results.length - 1];
    idx++;
    return r;
  };
}

const BASE_TRAIL = {
  id: "trail-1",
  deviceId: "device-1",
  label: "New",
  labelSource: "USER" as const,
  labelUpdatedAt: new Date("2026-02-01T00:00:00Z"),
  createdAt: new Date("2026-02-01T00:00:00Z"),
  updatedAt: new Date("2026-02-01T00:00:00Z"),
  savedAt: new Date("2026-02-01T00:00:00Z"),
  nodeCount: 1,
  rootUrl: null,
  rootTitle: null,
  rootFavicon: null,
  payload: { v: 1 },
  deletedAt: null,
};

function setupUserAndDevice(userId = "user-1", deviceId = "device-1") {
  setTable("users", { data: { id: userId }, error: null });
  setTable("devices", {
    data: [{ id: deviceId, user_id: userId }],
    error: null,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("upsertTrail", () => {
  beforeEach(() => {
    dbMock.from.mockClear();
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: null, error: null });
    for (const key of Object.keys(tableMocks)) {
      delete tableMocks[key];
    }
  });

  it("calls upsert_trail RPC with the canonical payload (no read-then-write)", async () => {
    setupUserAndDevice();
    rpcMock.mockResolvedValue({
      data: {
        id: "trail-1",
        applied: true,
        updated_at: "2026-02-01T00:00:00.000Z",
      },
      error: null,
    });

    const result = await upsertTrail({
      userId: "user-1",
      deviceId: "device-1",
      trail: BASE_TRAIL,
    });

    expect(result.applied).toBe(true);
    expect(result.updatedAt).toEqual(new Date("2026-02-01T00:00:00Z"));
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith(
      "upsert_trail",
      expect.objectContaining({
        p_trail: expect.objectContaining({
          id: "trail-1",
          user_id: "user-1",
          device_id: "device-1",
          label: "New",
          label_source: "USER",
          updated_at: "2026-02-01T00:00:00.000Z",
        }),
      }),
    );
    // Trails table should not be selected/updated directly — RPC owns it.
    const fromCalls = dbMock.from.mock.calls.map((c) => c[0]);
    expect(fromCalls).not.toContain("trails");
  });

  it("propagates client-provided trail id into the RPC payload", async () => {
    setupUserAndDevice();
    rpcMock.mockResolvedValue({
      data: {
        id: "trail-client-id",
        applied: true,
        updated_at: "2026-02-01T00:00:00.000Z",
      },
      error: null,
    });

    await upsertTrail({
      userId: "user-1",
      deviceId: "device-1",
      trail: { ...BASE_TRAIL, id: "trail-client-id" },
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "upsert_trail",
      expect.objectContaining({
        p_trail: expect.objectContaining({ id: "trail-client-id" }),
      }),
    );
  });

  it("creates missing device before invoking the RPC", async () => {
    setTable("users", { data: { id: "user-1" }, error: null });
    // devices: existing query → empty; subsequent upsert/update → ok
    setTableSeq("devices", [
      { data: [], error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    rpcMock.mockResolvedValue({
      data: {
        id: "trail-new",
        applied: true,
        updated_at: "2026-02-01T00:00:00.000Z",
      },
      error: null,
    });

    const result = await upsertTrail({
      userId: "user-1",
      deviceId: "device-new",
      trail: { ...BASE_TRAIL, id: "trail-new", deviceId: "device-new" },
    });

    expect(result.applied).toBe(true);
    const fromCalls = dbMock.from.mock.calls.map((c) => c[0]);
    expect(
      fromCalls.filter((t) => t === "devices").length,
    ).toBeGreaterThanOrEqual(2);
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("throws user_not_found when user does not exist", async () => {
    setTable("users", { data: null, error: null });

    await expect(
      upsertTrail({
        userId: "user-missing",
        deviceId: "device-1",
        trail: { ...BASE_TRAIL, id: "trail-1" },
      }),
    ).rejects.toThrowError("user_not_found");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects with device_user_mismatch when device belongs to a different user", async () => {
    setTable("users", { data: { id: "user-1" }, error: null });
    setTable("devices", {
      data: [{ id: "device-1", user_id: "other-user" }],
      error: null,
    });

    await expect(
      upsertTrail({
        userId: "user-1",
        deviceId: "device-1",
        trail: BASE_TRAIL,
      }),
    ).rejects.toMatchObject({ code: "device_user_mismatch", status: 409 });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns applied=false when the RPC LWW guard rejects an older write", async () => {
    setupUserAndDevice();
    rpcMock.mockResolvedValue({
      data: {
        id: "trail-1",
        applied: false,
        updated_at: "2026-03-01T00:00:00.000Z",
      },
      error: null,
    });

    const result = await upsertTrail({
      userId: "user-1",
      deviceId: "device-1",
      trail: { ...BASE_TRAIL, updatedAt: new Date("2026-01-01T00:00:00Z") },
    });

    expect(result.applied).toBe(false);
    expect(result.updatedAt).toEqual(new Date("2026-03-01T00:00:00Z"));
  });

  it("surfaces RPC errors as Error", async () => {
    setupUserAndDevice();
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    await expect(
      upsertTrail({
        userId: "user-1",
        deviceId: "device-1",
        trail: BASE_TRAIL,
      }),
    ).rejects.toThrowError(/upsert_trail RPC failed/);
  });
});
