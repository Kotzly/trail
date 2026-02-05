import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  verifyUserToken: vi.fn(),
}));

const userMocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  db: {
    accountSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/src/server/auth/user-auth", () => ({
  ...authMocks,
}));

vi.mock("@/src/server/user", () => ({
  ...userMocks,
}));

vi.mock("@trail/db", () => ({
  ...dbMocks,
}));

import { GET, PATCH } from "../account/settings/route";

describe("v1 account settings", () => {
  beforeEach(() => {
    authMocks.verifyUserToken.mockReset();
    userMocks.ensureUser.mockReset();
    dbMocks.db.accountSettings.findUnique.mockReset();
    dbMocks.db.accountSettings.upsert.mockReset();
  });

  it("returns default TTL when settings are missing", async () => {
    authMocks.verifyUserToken.mockResolvedValue({ sub: "user-1" });
    userMocks.ensureUser.mockResolvedValue({ id: "user-1" });
    dbMocks.db.accountSettings.findUnique.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/v1/account/settings", {
        headers: { Authorization: "Bearer user-token" },
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.deviceSessionTtlDays).toBe(30);
  });

  it("updates device session TTL", async () => {
    authMocks.verifyUserToken.mockResolvedValue({ sub: "user-1" });
    userMocks.ensureUser.mockResolvedValue({ id: "user-1" });
    dbMocks.db.accountSettings.upsert.mockResolvedValue({
      userId: "user-1",
      deviceSessionTtlDays: "DAYS_90",
    });

    const response = await PATCH(
      new Request("http://localhost/v1/account/settings", {
        method: "PATCH",
        headers: { Authorization: "Bearer user-token" },
        body: JSON.stringify({ deviceSessionTtlDays: 90 }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.deviceSessionTtlDays).toBe(90);
  });
});
