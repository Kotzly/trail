import { describe, it, expect } from "vitest";

describe("@trail/db client", () => {
  it("exposes createDb() that produces a typed client", async () => {
    // Test that the package loads without throwing at import (previously
    // the module threw on import when env was missing, preventing any
    // consumer from even reaching this assertion — closes P2.19).
    const mod = await import("../client");
    expect(typeof mod.createDb).toBe("function");
    const db = mod.createDb();
    expect(typeof db.from).toBe("function");
  });

  it("lazy db Proxy forwards property access to a real client", async () => {
    const { db } = await import("../client");
    // Access through the Proxy — should return a builder instance, not
    // throw "missing env" because the test harness set NEXT_PUBLIC_SUPABASE_URL
    // and SUPABASE_SERVICE_ROLE_KEY.
    const builder = db.from("users");
    expect(builder).toBeDefined();
    expect(typeof builder.select).toBe("function");
  });

  it("exports Database and SupabaseClient types via ./types", async () => {
    const types = await import("../types");
    // At runtime these are type-only exports, so we just assert the
    // module loads and is an object — the real guarantee is that
    // consumers can `import type { Database } from "@trail/db/types"`
    // without pulling the throwing client module into their graph.
    expect(types).toBeDefined();
  });
});
