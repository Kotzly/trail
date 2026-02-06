import { beforeEach, describe, expect, it, vi } from "vitest";

const userMocks = vi.hoisted(() => ({
  getUserOnboardingSeen: vi.fn(),
  markUserOnboardingSeen: vi.fn(),
}));

const internalAuthMocks = vi.hoisted(() => ({
  requireInternalKey: vi.fn(() => null),
}));

const responseMocks = vi.hoisted(() => ({
  jsonNoStore: vi.fn((data: unknown, init: ResponseInit = {}) =>
    Response.json(data, init),
  ),
}));

vi.mock("@/src/server/user", () => ({
  ...userMocks,
}));

vi.mock("@/src/server/internal-auth", () => ({
  ...internalAuthMocks,
}));

vi.mock("@/src/server/response", () => ({
  ...responseMocks,
}));

import { GET, POST } from "./route";

describe("internal user onboarding route", () => {
  beforeEach(() => {
    userMocks.getUserOnboardingSeen.mockReset();
    userMocks.markUserOnboardingSeen.mockReset();
    internalAuthMocks.requireInternalKey.mockReset();
    internalAuthMocks.requireInternalKey.mockReturnValue(null);
    responseMocks.jsonNoStore.mockClear();
  });

  it("returns seen=false for a new user", async () => {
    userMocks.getUserOnboardingSeen.mockResolvedValue(false);

    const response = await GET(
      new Request("http://localhost/api/internal/users/user-1/onboarding", {
        headers: { "x-trail-internal-key": "test-internal-key" },
      }),
      { params: Promise.resolve({ id: "user-1" }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ seen: false });
  });

  it("marks onboarding as seen", async () => {
    userMocks.markUserOnboardingSeen.mockResolvedValue(true);

    const response = await POST(
      new Request("http://localhost/api/internal/users/user-1/onboarding", {
        method: "POST",
        headers: { "x-trail-internal-key": "test-internal-key" },
      }),
      { params: Promise.resolve({ id: "user-1" }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ seen: true });
  });
});
