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

import { GET as getBilling } from "../billing/route";
import { POST as createCheckout } from "../subscription/checkout/route";
import { POST as createPortal } from "../billing/portal/route";
import { GET as getPlans } from "../plans/route";

describe("account v1 billing proxy routes", () => {
  beforeEach(() => {
    authMocks.verifyExtensionAccessToken.mockReset();
    internalApiMocks.internalApiFetch.mockReset();
  });

  it("returns 401 when billing token is invalid", async () => {
    authMocks.verifyExtensionAccessToken.mockReturnValue(null);

    const response = await getBilling(
      new Request("http://localhost/v1/billing", {
        headers: { Authorization: "Bearer bad-token" },
      }),
    );

    expect(response.status).toBe(401);
    expect(internalApiMocks.internalApiFetch).not.toHaveBeenCalled();
  });

  it("proxies billing status response", async () => {
    authMocks.verifyExtensionAccessToken.mockReturnValue({
      sub: "user-1",
      iat: 0,
      exp: 999999,
    });
    internalApiMocks.internalApiFetch.mockResolvedValue(
      new Response(JSON.stringify({ state: "none" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await getBilling(
      new Request("http://localhost/v1/billing", {
        headers: { Authorization: "Bearer extension-token" },
      }),
    );

    expect(response.status).toBe(200);
    expect(internalApiMocks.internalApiFetch).toHaveBeenCalledWith(
      "/api/v1/billing",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer extension-token",
        },
      },
    );
    await expect(response.json()).resolves.toEqual({ state: "none" });
  });

  it("proxies checkout session creation", async () => {
    authMocks.verifyExtensionAccessToken.mockReturnValue({
      sub: "user-1",
      iat: 0,
      exp: 999999,
    });
    internalApiMocks.internalApiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          url: "https://billing.example.test/checkout",
          expiresAt: null,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const payload = { planId: "pro", interval: "month" };
    const response = await createCheckout(
      new Request("http://localhost/v1/subscription/checkout", {
        method: "POST",
        headers: {
          Authorization: "Bearer extension-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(200);
    expect(internalApiMocks.internalApiFetch).toHaveBeenCalledWith(
      "/api/v1/subscription/checkout",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer extension-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
  });

  it("proxies billing portal creation", async () => {
    authMocks.verifyExtensionAccessToken.mockReturnValue({
      sub: "user-1",
      iat: 0,
      exp: 999999,
    });
    internalApiMocks.internalApiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          url: "https://billing.example.test/portal",
          expiresAt: null,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const payload = { returnUrl: "https://app.gettrail.net/billing" };
    const response = await createPortal(
      new Request("http://localhost/v1/billing/portal", {
        method: "POST",
        headers: {
          Authorization: "Bearer extension-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(200);
    expect(internalApiMocks.internalApiFetch).toHaveBeenCalledWith(
      "/api/v1/billing/portal",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer extension-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
  });

  it("proxies plans list without auth token", async () => {
    internalApiMocks.internalApiFetch.mockResolvedValue(
      new Response(JSON.stringify([{ id: "free" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await getPlans();

    expect(response.status).toBe(200);
    expect(internalApiMocks.internalApiFetch).toHaveBeenCalledWith(
      "/api/v1/plans",
      { method: "GET" },
    );
    await expect(response.json()).resolves.toEqual([{ id: "free" }]);
  });
});
