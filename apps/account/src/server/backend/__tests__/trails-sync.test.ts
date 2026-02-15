import { describe, expect, it } from "vitest";
import { mergeTrailUpdates } from "../trails-sync";

describe("mergeTrailUpdates", () => {
  it("rejects stale updates after tombstone", () => {
    const server = {
      id: "t1",
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      deletedAt: new Date("2026-01-02T00:00:00Z"),
    };
    const client = {
      id: "t1",
      updatedAt: new Date("2026-01-01T12:00:00Z"),
      deletedAt: null,
    };

    const result = mergeTrailUpdates(server, client);
    expect(result.applied).toBe(false);
  });
});
