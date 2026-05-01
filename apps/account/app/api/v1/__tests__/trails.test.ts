import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Supabase fluent builder mock + auth shim
// ---------------------------------------------------------------------------

type QueryResult = {
  data: unknown;
  error: null | { message: string; code?: string };
  count?: number | null;
};

const fluent = vi.hoisted(() => {
  const tableMocks: Record<string, () => QueryResult> = {};
  const lastUpdate: Record<string, unknown> = {};

  const defaultResult = (): QueryResult => ({ data: null, error: null });

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
    const chain: Record<string, unknown> = {};
    for (const m of passthrough) {
      chain[m] = (...args: unknown[]) => {
        if (m === "update" || m === "upsert" || m === "insert") {
          lastUpdate[`${table}.${m}`] = args[0];
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
    ) => Promise.resolve(result).then(resolve, reject);
    return chain;
  }

  const dbMock = {
    from: vi.fn((table: string) => {
      const factory = tableMocks[table];
      const result = factory ? factory() : defaultResult();
      return makeChain(table, result);
    }),
  };

  const authMock = {
    getAuthenticatedUserId: vi.fn(),
    getAuthenticatedUser: vi.fn(),
  };

  return { tableMocks, lastUpdate, dbMock, authMock };
});

vi.mock("@trail/db", () => ({ db: fluent.dbMock }));

vi.mock("@/src/server/auth/get-authenticated-user", () => ({
  getAuthenticatedUserId: fluent.authMock.getAuthenticatedUserId,
  getAuthenticatedUser: fluent.authMock.getAuthenticatedUser,
}));

vi.mock("@/src/server/backend/auth/extension-auth", () => ({
  verifyExtensionToken: vi.fn(async () => null),
}));

vi.mock("@/src/server/backend/user", () => ({
  ensureUser: vi.fn(async ({ sub }: { sub: string }) => ({ id: sub })),
}));

// `cookies()` from next/headers — keep server.ts's createSupabaseServerClient quiet
// for routes that fall through to the cookie-session branch (list/cookie path).
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => {
      /* noop */
    },
  }),
}));

import { GET as listTrails } from "../trails/route";
import {
  PATCH as updateTrail,
  DELETE as deleteTrail,
} from "../trails/[id]/route";
import { POST as restoreTrail } from "../trails/[id]/restore/route";

const { tableMocks, lastUpdate, dbMock, authMock } = fluent;

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

const TRAIL_ROW = {
  id: "trail-1",
  user_id: "user-1",
  device_id: "device-1",
  label: "Trail 1",
  label_source: "USER",
  label_updated_at: "2026-02-01T00:00:00.000Z",
  created_at: "2026-02-01T00:00:00.000Z",
  updated_at: "2026-02-02T00:00:00.000Z",
  saved_at: "2026-02-02T00:00:00.000Z",
  node_count: 2,
  root_url: null,
  root_title: null,
  root_favicon: null,
  payload: { v: 1 },
  deleted_at: null,
};

describe("v1 trails endpoints", () => {
  beforeEach(() => {
    dbMock.from.mockClear();
    authMock.getAuthenticatedUserId.mockReset();
    authMock.getAuthenticatedUserId.mockResolvedValue("user-1");
    authMock.getAuthenticatedUser.mockReset();
    authMock.getAuthenticatedUser.mockResolvedValue({
      id: "user-1",
      email: null,
      name: null,
      imageUrl: null,
    });
    for (const k of Object.keys(tableMocks)) delete tableMocks[k];
    for (const k of Object.keys(lastUpdate)) delete lastUpdate[k];
  });

  describe("GET /trails", () => {
    it("paginates with limit+1 and exposes nextCursor when results overflow", async () => {
      // The list route fetches limit+1, slices off the last, and exposes nextCursor.
      // Two thenable queries: trailsQuery and countQuery.
      setTableSeq("trails", [
        {
          data: [
            TRAIL_ROW,
            {
              ...TRAIL_ROW,
              id: "trail-2",
              updated_at: "2026-02-01T00:00:00.000Z",
            },
          ],
          error: null,
        },
        { data: null, error: null, count: 2 },
      ]);

      const response = await listTrails(
        new Request("http://localhost/api/v1/trails?limit=1", {
          headers: { Authorization: "Bearer user-token" },
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].id).toBe("trail-1");
      expect(body.nextCursor).toBe("2026-02-02T00:00:00.000Z|trail-1");
      expect(body.totalCount).toBe(2);
    });

    it("returns empty list with null cursor when no rows", async () => {
      setTableSeq("trails", [
        { data: [], error: null },
        { data: null, error: null, count: 0 },
      ]);

      const response = await listTrails(
        new Request(
          "http://localhost/api/v1/trails?cursor=2026-02-01T00:00:00.000Z%7Ctrail-2",
          { headers: { Authorization: "Bearer user-token" } },
        ),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.items).toEqual([]);
      expect(body.nextCursor).toBeNull();
    });

    it("returns 401 when unauthenticated and the cookie session is empty", async () => {
      authMock.getAuthenticatedUser.mockResolvedValueOnce(null);
      // No bearer + no cookie session → resolveUser returns null.
      const response = await listTrails(
        new Request("http://localhost/api/v1/trails", {}),
      );
      expect(response.status).toBe(401);
    });
  });

  describe("PATCH /trails/:id", () => {
    it("updates label and labelSource", async () => {
      setTable("trails", {
        data: { ...TRAIL_ROW, label: "Updated", label_source: "USER" },
        error: null,
      });

      const response = await updateTrail(
        new Request("http://localhost/api/v1/trails/trail-1", {
          method: "PATCH",
          headers: { Authorization: "Bearer user-token" },
          body: JSON.stringify({ label: "Updated", labelSource: "user" }),
        }),
        { params: Promise.resolve({ id: "trail-1" }) },
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.label).toBe("Updated");
      expect(body.labelSource).toBe("user");

      const updateArgs = lastUpdate["trails.update"] as Record<string, unknown>;
      expect(updateArgs).toMatchObject({
        label: "Updated",
        label_source: "USER",
      });
    });

    it("returns 404 when row not found (PGRST116)", async () => {
      setTable("trails", {
        data: null,
        error: { code: "PGRST116", message: "no rows" },
      });

      const response = await updateTrail(
        new Request("http://localhost/api/v1/trails/missing", {
          method: "PATCH",
          headers: { Authorization: "Bearer user-token" },
          body: JSON.stringify({ label: "x" }),
        }),
        { params: Promise.resolve({ id: "missing" }) },
      );

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /trails/:id", () => {
    it("soft deletes by setting deleted_at", async () => {
      const deletedAt = "2026-02-02T00:00:00.000Z";
      setTable("trails", {
        data: { ...TRAIL_ROW, deleted_at: deletedAt },
        error: null,
      });

      const response = await deleteTrail(
        new Request("http://localhost/api/v1/trails/trail-1", {
          method: "DELETE",
          headers: { Authorization: "Bearer user-token" },
        }),
        { params: Promise.resolve({ id: "trail-1" }) },
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.deletedAt).toBe(deletedAt);

      const updateArgs = lastUpdate["trails.update"] as Record<string, unknown>;
      expect(updateArgs.deleted_at).toBeTypeOf("string");
    });
  });

  describe("POST /trails/:id/restore", () => {
    it("clears deleted_at", async () => {
      setTable("trails", {
        data: { ...TRAIL_ROW, deleted_at: null },
        error: null,
      });

      const response = await restoreTrail(
        new Request("http://localhost/api/v1/trails/trail-1/restore", {
          method: "POST",
          headers: { Authorization: "Bearer user-token" },
        }),
        { params: Promise.resolve({ id: "trail-1" }) },
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.deletedAt).toBeNull();

      const updateArgs = lastUpdate["trails.update"] as Record<string, unknown>;
      expect(updateArgs.deleted_at).toBeNull();
    });
  });
});
