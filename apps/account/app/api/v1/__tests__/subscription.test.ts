const authMocks = vi.hoisted(() => ({
  verifyExtensionAccessToken: vi.fn(),
}));

const internalApiMocks = vi.hoisted(() => ({
  internalApiFetch: vi.fn(),
}));

vi.mock("@/src/server/extension-auth", () => ({
  ...authMocks,
}));

vi.mock("@/src/server/internal-api", () => ({
  ...internalApiMocks,
}));

import { GET as getSubscription } from "../subscription/route";

describe("account v1 subscription proxy", () => {
  beforeEach(() => {
    authMocks.verifyExtensionAccessToken.mockReset();
    internalApiMocks.internalApiFetch.mockReset();
  });

  it("returns 401 when token is invalid", async () => {
    authMocks.verifyExtensionAccessToken.mockReturnValue(null);

    const response = await getSubscription(
      new Request("http://localhost/v1/subscription", {
        headers: { Authorization: "Bearer bad-token" },
      }),
    );

    expect(response.status).toBe(401);
    expect(internalApiMocks.internalApiFetch).not.toHaveBeenCalled();
  });

  it("proxies upstream subscription response", async () => {
    authMocks.verifyExtensionAccessToken.mockReturnValue({
      sub: "user-1",
      iat: 0,
      exp: 999999,
    });
    internalApiMocks.internalApiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "sub_1",
          planId: "pro",
          status: "active",
          interval: "month",
          currentPeriodStart: "2026-02-01T00:00:00.000Z",
          currentPeriodEnd: "2026-03-01T00:00:00.000Z",
          cancelAtPeriodEnd: false,
          trialEndsAt: null,
          canceledAt: null,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const response = await getSubscription(
      new Request("http://localhost/v1/subscription", {
        headers: { Authorization: "Bearer extension-token" },
      }),
    );

    expect(response.status).toBe(200);
    expect(internalApiMocks.internalApiFetch).toHaveBeenCalledWith(
      "/api/v1/subscription",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer extension-token",
        },
      },
    );
    await expect(response.json()).resolves.toEqual({
      id: "sub_1",
      planId: "pro",
      status: "active",
      interval: "month",
      currentPeriodStart: "2026-02-01T00:00:00.000Z",
      currentPeriodEnd: "2026-03-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      canceledAt: null,
    });
  });
});
