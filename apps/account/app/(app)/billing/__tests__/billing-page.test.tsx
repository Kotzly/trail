import React from "react";
import { render, screen } from "@testing-library/react";

const internalApiMocks = vi.hoisted(() => ({
  internalApiJson: vi.fn(),
}));

vi.mock("@/src/server/internal-api", () => ({
  ...internalApiMocks,
}));

import BillingPage from "../page";

describe("BillingPage", () => {
  it("renders plan cards with toggle", async () => {
    internalApiMocks.internalApiJson.mockResolvedValue([
      {
        id: "free",
        name: "free",
        tier: "free",
        priceMonthly: 0,
        priceYearly: 0,
        currency: "USD",
        features: ["basic"],
        rank: 0,
      },
      {
        id: "pro",
        name: "pro",
        tier: "pro",
        priceMonthly: 8,
        priceYearly: 72,
        currency: "USD",
        features: ["sync"],
        highlight: true,
        rank: 1,
      },
      {
        id: "teams",
        name: "teams",
        tier: "teams",
        priceMonthly: 16,
        priceYearly: 144,
        currency: "USD",
        features: ["shared"],
        rank: 2,
      },
    ]);

    render(await BillingPage());

    expect(screen.getAllByText("free").length).toBeGreaterThan(0);
    expect(screen.getByText("pro")).toBeInTheDocument();
    expect(screen.getByText("teams")).toBeInTheDocument();
    expect(screen.getByText("monthly")).toBeInTheDocument();
    expect(screen.getByText("yearly")).toBeInTheDocument();
  });
});
