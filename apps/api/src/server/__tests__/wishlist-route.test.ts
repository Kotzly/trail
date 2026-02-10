import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const upsertWishlistLead = vi.hoisted(() =>
  vi.fn(
    async (input: {
      email: string;
      source: string;
      userId?: string | null;
    }) => ({
      id: "lead-1",
      email: input.email,
      userId: input.userId ?? null,
      sources: [input.source],
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    }),
  ),
);

vi.mock("@/src/server/wishlist", () => ({
  upsertWishlistLead,
}));

vi.mock("@/src/server/user", () => ({
  ensureUser: vi.fn(async () => ({ id: "user-1" })),
}));

import { POST } from "../../../app/api/v1/wishlist/route";

describe("POST /v1/wishlist", () => {
  it("returns 400 when email is missing", async () => {
    const response = await POST(
      new Request("http://localhost/v1/wishlist", {
        method: "POST",
        body: JSON.stringify({ source: "marketing" }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.code).toBe("email_required");
  });

  it("creates or updates a lead", async () => {
    const response = await POST(
      new Request("http://localhost/v1/wishlist", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          source: "marketing",
        }),
      }),
    );

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.email).toBe("test@example.com");
    expect(payload.sources).toEqual(["marketing"]);
    expect(upsertWishlistLead).toHaveBeenCalledWith(
      expect.objectContaining({ source: "MARKETING" }),
    );
  });
});
