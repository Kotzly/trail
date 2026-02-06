const internalApiMocks = vi.hoisted(() => ({
  internalApiJson: vi.fn(),
}));

vi.mock("@/src/server/internal-api", () => ({
  ...internalApiMocks,
}));

import { getExtensionConfig } from "../extension-config";

describe("account extension config", () => {
  beforeEach(() => {
    internalApiMocks.internalApiJson.mockReset();
  });

  it("returns normalized primitive config values from api", async () => {
    internalApiMocks.internalApiJson.mockResolvedValue({
      config: {
        payments: true,
        billingV2: "beta",
        rollout: 42,
        nested: { enabled: true },
      },
    });

    const config = await getExtensionConfig();

    expect(config).toEqual({
      payments: true,
      billingV2: "beta",
      rollout: 42,
    });
  });

  it("returns empty config when api is unavailable", async () => {
    internalApiMocks.internalApiJson.mockRejectedValue(new Error("boom"));

    const config = await getExtensionConfig();

    expect(config).toEqual({});
  });
});
