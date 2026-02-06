import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillingPlansClient } from "../BillingPlansClient";
import type { BillingPlanView } from "../BillingPlansClient";

const plans: BillingPlanView[] = [
  {
    id: "free",
    name: "free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: "USD",
    features: ["basic"],
    popular: false,
  },
  {
    id: "pro",
    name: "pro",
    monthlyPrice: 8,
    yearlyPrice: 72,
    currency: "USD",
    features: ["sync"],
    popular: true,
  },
];

describe("BillingPlansClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts yearly checkout for pro plan by default", async () => {
    const fetchMock = vi.mocked(fetch);
    const navigateSpy = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          url: "https://checkout.example.test/year",
          expiresAt: null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const user = userEvent.setup();
    render(<BillingPlansClient plans={plans} onNavigate={navigateSpy} />);

    await user.click(screen.getByRole("button", { name: "upgrade to pro" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const lastCall = fetchMock.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe("/api/billing/checkout");
    const requestInit = lastCall?.[1] as RequestInit;
    expect(requestInit.method).toBe("POST");
    expect(requestInit.headers).toEqual({ "Content-Type": "application/json" });
    const payload = JSON.parse(String(requestInit.body));
    expect(payload.planId).toBe("pro");
    expect(payload.interval).toBe("year");

    expect(navigateSpy).toHaveBeenCalledWith(
      "https://checkout.example.test/year",
    );
  });

  it("starts monthly checkout when monthly toggle is selected", async () => {
    const fetchMock = vi.mocked(fetch);
    const navigateSpy = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          url: "https://checkout.example.test/month",
          expiresAt: null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const user = userEvent.setup();
    render(<BillingPlansClient plans={plans} onNavigate={navigateSpy} />);

    await user.click(screen.getByRole("button", { name: "monthly" }));
    await user.click(screen.getByRole("button", { name: "upgrade to pro" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const lastCall = fetchMock.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe("/api/billing/checkout");
    const requestInit = lastCall?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body));
    expect(payload.planId).toBe("pro");
    expect(payload.interval).toBe("month");

    expect(navigateSpy).toHaveBeenCalledWith(
      "https://checkout.example.test/month",
    );
  });
});
