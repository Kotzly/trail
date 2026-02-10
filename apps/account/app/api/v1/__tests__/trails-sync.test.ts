const internalApiMocks = vi.hoisted(() => ({
  internalApiFetch: vi.fn(),
}));

vi.mock("@/src/server/internal-api", () => ({
  ...internalApiMocks,
}));

import { POST as sync } from "../trails/sync/route";

describe("account v1 trails sync proxy", () => {
  beforeEach(() => {
    internalApiMocks.internalApiFetch.mockReset();
  });

  it("returns 401 when bearer token is missing", async () => {
    const response = await sync(
      new Request("http://localhost/v1/trails/sync", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
    expect(internalApiMocks.internalApiFetch).not.toHaveBeenCalled();
  });

  it("proxies request to api and returns upstream response", async () => {
    internalApiMocks.internalApiFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          serverSyncAt: "2026-02-06T10:00:00.000Z",
          updates: [],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    const response = await sync(
      new Request("http://localhost/v1/trails/sync", {
        method: "POST",
        headers: {
          Authorization: "Bearer extension-token",
        },
        body: JSON.stringify({
          deviceId: "device-1",
          clientSyncAt: "2026-02-06T09:00:00.000Z",
          trails: [],
        }),
      }),
    );

    expect(internalApiMocks.internalApiFetch).toHaveBeenCalledWith(
      "/api/v1/trails/sync",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer extension-token",
        }),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      serverSyncAt: "2026-02-06T10:00:00.000Z",
      updates: [],
    });
  });
});
