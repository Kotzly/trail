const authMocks = vi.hoisted(() => ({
  getAuthTokenFromCookies: vi.fn(),
}));

const internalApiMocks = vi.hoisted(() => ({
  internalApiFetch: vi.fn(),
}));

vi.mock("@/src/lib/auth", () => ({
  ...authMocks,
}));

vi.mock("@/src/server/internal-api", () => ({
  ...internalApiMocks,
}));

import { POST as checkout } from "../route";

describe("account api billing checkout route", () => {
  beforeEach(() => {
    authMocks.getAuthTokenFromCookies.mockReset();
    internalApiMocks.internalApiFetch.mockReset();
  });

  it("returns 401 when auth token is missing", async () => {
    authMocks.getAuthTokenFromCookies.mockResolvedValue(null);

    const response = await checkout(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planId: "pro", interval: "year" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "auth",
      redirectUrl: expect.any(String),
    });
    expect(internalApiMocks.internalApiFetch).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid body", async () => {
    authMocks.getAuthTokenFromCookies.mockResolvedValue("token-1");

    const response = await checkout(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planId: "", interval: "invalid" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(internalApiMocks.internalApiFetch).not.toHaveBeenCalled();
  });

  it("proxies checkout request to api", async () => {
    authMocks.getAuthTokenFromCookies.mockResolvedValue("token-1");
    internalApiMocks.internalApiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          url: "https://checkout.example.test",
          expiresAt: null,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const payload = {
      planId: "pro",
      interval: "year",
      successUrl: "http://localhost:3001/billing?checkout=success",
      cancelUrl: "http://localhost:3001/billing?checkout=cancelled",
    };

    const response = await checkout(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(200);
    expect(internalApiMocks.internalApiFetch).toHaveBeenCalledWith(
      "/api/v1/subscription/checkout",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer token-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    await expect(response.json()).resolves.toEqual({
      url: "https://checkout.example.test",
      expiresAt: null,
    });
  });
});
