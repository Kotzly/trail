import { beforeEach, describe, expect, it, vi } from "vitest";

const internalAuthMocks = vi.hoisted(() => ({
  requireInternalKey: vi.fn(() => null),
}));

const extensionAuthMocks = vi.hoisted(() => ({
  createExtensionToken: vi.fn(() => ({
    token: "ext-token",
    expiresAt: "2026-02-06T10:30:00.000Z",
  })),
}));

const responseMocks = vi.hoisted(() => ({
  jsonNoStore: vi.fn((data: unknown, init: ResponseInit = {}) =>
    Response.json(data, init),
  ),
}));

const dbMocks = vi.hoisted(() => ({
  extensionLoginCode: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@trail/db", () => ({
  db: dbMocks,
}));

vi.mock("@/src/server/internal-auth", () => ({
  ...internalAuthMocks,
}));

vi.mock("@/src/server/auth/extension-auth", () => ({
  ...extensionAuthMocks,
}));

vi.mock("@/src/server/response", () => ({
  ...responseMocks,
}));

import { POST } from "./route";

describe("internal extension exchange route", () => {
  beforeEach(() => {
    internalAuthMocks.requireInternalKey.mockReset();
    internalAuthMocks.requireInternalKey.mockReturnValue(null);
    extensionAuthMocks.createExtensionToken.mockReset();
    extensionAuthMocks.createExtensionToken.mockReturnValue({
      token: "ext-token",
      expiresAt: "2026-02-06T10:30:00.000Z",
    });
    responseMocks.jsonNoStore.mockClear();
    dbMocks.extensionLoginCode.findUnique.mockReset();
    dbMocks.extensionLoginCode.update.mockReset();
  });

  it("returns token for a valid login code", async () => {
    dbMocks.extensionLoginCode.findUnique.mockResolvedValue({
      id: "code-1",
      expiresAt: new Date("2099-02-06T10:00:00.000Z"),
      usedAt: null,
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "User",
      },
    });
    dbMocks.extensionLoginCode.update.mockResolvedValue({});

    const response = await POST(
      new Request("http://localhost/api/internal/extension/exchange", {
        method: "POST",
        headers: { "x-trail-internal-key": "test-key" },
        body: JSON.stringify({ code: "abc123" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "User",
      },
      token: "ext-token",
      expiresAt: "2026-02-06T10:30:00.000Z",
    });
    expect(extensionAuthMocks.createExtensionToken).toHaveBeenCalledWith("user-1");
  });
});
