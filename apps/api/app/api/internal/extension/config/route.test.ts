import { beforeEach, describe, expect, it, vi } from "vitest";

const internalAuthMocks = vi.hoisted(() => ({
  requireInternalKey: vi.fn(() => null),
}));

const responseMocks = vi.hoisted(() => ({
  jsonNoStore: vi.fn((data: unknown, init: ResponseInit = {}) =>
    Response.json(data, init),
  ),
}));

const configMocks = vi.hoisted(() => ({
  getExtensionConfig: vi.fn(() => ({
    config: {
      payments: true,
      billingV2: "beta",
      rollout: 25,
    },
  })),
}));

vi.mock("@/src/server/internal-auth", () => ({
  ...internalAuthMocks,
}));

vi.mock("@/src/server/response", () => ({
  ...responseMocks,
}));

vi.mock("@/src/server/extension-config", () => ({
  ...configMocks,
}));

import { GET } from "./route";

describe("internal extension config route", () => {
  beforeEach(() => {
    internalAuthMocks.requireInternalKey.mockReset();
    internalAuthMocks.requireInternalKey.mockReturnValue(null);
    responseMocks.jsonNoStore.mockClear();
    configMocks.getExtensionConfig.mockClear();
  });

  it("returns extension config for internal callers", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/extension/config", {
        headers: { "x-trail-internal-key": "test-key" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      config: {
        payments: true,
        billingV2: "beta",
        rollout: 25,
      },
    });
    expect(configMocks.getExtensionConfig).toHaveBeenCalledTimes(1);
  });
});
