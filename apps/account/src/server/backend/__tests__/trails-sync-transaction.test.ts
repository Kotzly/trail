import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Supabase chainable query builder mock
// ---------------------------------------------------------------------------

type QueryResult = { data: unknown; error: null | { message: string; code?: string }; count?: number | null };

function makeChain(result: QueryResult) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select", "eq", "neq", "is", "not", "in", "gt", "lt", "gte", "lte",
    "or", "order", "limit", "maybeSingle", "single", "upsert", "insert",
    "update", "delete", "ignoreDuplicates",
  ];
  for (const m of methods) {
    chain[m] = (..._args: unknown[]) => {
      // maybeSingle / single resolve the chain
      if (m === "maybeSingle" || m === "single") {
        return Promise.resolve(result);
      }
      return chain;
    };
  }
  // Make the chain itself thenable so `await db.from(...).select(...)` works
  chain.then = (resolve: (v: QueryResult) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

// Per-table mock factories — tests can override these
const tableMocks: Record<string, () => QueryResult> = {};

function defaultResult(): QueryResult {
  return { data: null, error: null };
}

const dbMock = {
  from: vi.fn((table: string) => {
    const factory = tableMocks[table];
    const result = factory ? factory() : defaultResult();
    const chain = makeChain(result);
    // Attach from back so nested calls work
    (chain as Record<string, unknown>).from = dbMock.from;
    return chain;
  }),
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
    for (const key of Object.keys(tableMocks)) {
      delete tableMocks[key];
    }
  });

  it("creates new trail when it does not exist", async () => {
    setupUserAndDevice();
    // trails: first call returns no existing, second (insert) returns the created row
    setTableSeq("trails", [
      { data: null, error: null },
      {
        data: { id: "trail-1", updated_at: "2026-02-01T00:00:00.000Z" },
        error: null,
      },
    ]);

    const result = await upsertTrail({
      userId: "user-1",
      deviceId: "device-1",
      trail: BASE_TRAIL,
    });

    expect(result.applied).toBe(true);
    expect(result.updatedAt).toEqual(new Date("2026-02-01T00:00:00Z"));
  });

  it("creates new trail with client-provided id", async () => {
    setupUserAndDevice();
    setTableSeq("trails", [
      { data: null, error: null },
      {
        data: { id: "trail-client-id", updated_at: "2026-02-01T00:00:00.000Z" },
        error: null,
      },
    ]);

    const result = await upsertTrail({
      userId: "user-1",
      deviceId: "device-1",
      trail: { ...BASE_TRAIL, id: "trail-client-id" },
    });

    expect(result.applied).toBe(true);
  });

  it("creates missing device before trail upsert", async () => {
    setTable("users", { data: { id: "user-1" }, error: null });
    // devices: no existing → empty array
    setTableSeq("devices", [
      { data: [], error: null },                              // select existing
      { data: null, error: null },                           // upsert missing
      { data: null, error: null },                           // update last_seen_at
    ]);
    setTableSeq("trails", [
      { data: null, error: null },
      { data: { id: "trail-new", updated_at: "2026-02-01T00:00:00.000Z" }, error: null },
    ]);

    const result = await upsertTrail({
      userId: "user-1",
      deviceId: "device-new",
      trail: { ...BASE_TRAIL, id: "trail-new", deviceId: "device-new" },
    });

    expect(result.applied).toBe(true);
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
  });

  it("skips update when server version is newer (LWW)", async () => {
    setupUserAndDevice();
    // Existing trail has newer updatedAt than client
    setTable("trails", {
      data: {
        id: "trail-1",
        updated_at: "2026-03-01T00:00:00.000Z",
        deleted_at: null,
      },
      error: null,
    });

    const result = await upsertTrail({
      userId: "user-1",
      deviceId: "device-1",
      trail: {
        ...BASE_TRAIL,
        updatedAt: new Date("2026-01-01T00:00:00Z"), // older than server
      },
    });

    expect(result.applied).toBe(false);
  });
});
