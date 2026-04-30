import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Supabase fluent builder mock with RPC support
// ---------------------------------------------------------------------------

type QR = { data: unknown; error: null | { message: string } };

interface CallRecord {
  table: string;
  op: "select" | "update" | "upsert" | "insert" | "delete" | "unknown";
}

const fluent = vi.hoisted(() => {
  const calls: CallRecord[] = [];
  const tableMocks: Record<string, () => QR> = {};
  const passthrough = [
    "select",
    "eq",
    "neq",
    "is",
    "not",
    "in",
    "or",
    "order",
    "limit",
    "maybeSingle",
    "single",
    "upsert",
    "insert",
    "update",
    "delete",
  ] as const;
  const ops = new Set(["select", "update", "upsert", "insert", "delete"]);

  function makeChain(table: string, result: QR) {
    const current: CallRecord = { table, op: "unknown" };
    const chain: Record<string, unknown> = {};
    for (const m of passthrough) {
      chain[m] = (..._args: unknown[]) => {
        if (ops.has(m)) {
          current.op = m as CallRecord["op"];
        }
        if (m === "maybeSingle" || m === "single") {
          return Promise.resolve(result);
        }
        return chain;
      };
    }
    chain.then = (
      resolve: (v: QR) => unknown,
      reject: (e: unknown) => unknown,
    ) => {
      calls.push(current);
      return Promise.resolve(result).then(resolve, reject);
    };
    return chain;
  }

  const rpc = vi.fn(
    async (_name: string, _args?: unknown): Promise<QR> => ({
      data: null,
      error: null,
    }),
  );

  const db = {
    from: vi.fn((table: string) => {
      const factory = tableMocks[table];
      const result = factory ? factory() : { data: null, error: null };
      return makeChain(table, result);
    }),
    rpc,
  };

  return { db, calls, tableMocks, rpc };
});

vi.mock("@trail/db", () => ({ db: fluent.db }));

import { revokeAllExtensionSessionsForUser } from "../oauth";

const { db: dbMock, calls, tableMocks, rpc } = fluent;

describe("revokeAllExtensionSessionsForUser", () => {
  beforeEach(() => {
    dbMock.from.mockClear();
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
    calls.length = 0;
    for (const k of Object.keys(tableMocks)) delete tableMocks[k];
  });

  it("invokes bump_auth_session_version RPC exactly once with the user id", async () => {
    await revokeAllExtensionSessionsForUser("user-1");

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("bump_auth_session_version", {
      p_user_id: "user-1",
    });
  });

  it("never reads before bumping the session version (no read-then-write)", async () => {
    await revokeAllExtensionSessionsForUser("user-1");

    // Only UPDATEs are issued against oauth_refresh_tokens and
    // extension_device_sessions. A SELECT preceding the RPC would
    // re-introduce the SEC-003 race window.
    expect(calls.find((c) => c.op === "select")).toBeUndefined();
    expect(calls).toEqual(
      expect.arrayContaining([
        { table: "oauth_refresh_tokens", op: "update" },
        { table: "extension_device_sessions", op: "update" },
      ]),
    );
  });

  it("propagates RPC errors instead of swallowing them", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "rpc-failure" },
    });

    await expect(
      revokeAllExtensionSessionsForUser("user-1"),
    ).rejects.toMatchObject({ message: "rpc-failure" });
  });
});
