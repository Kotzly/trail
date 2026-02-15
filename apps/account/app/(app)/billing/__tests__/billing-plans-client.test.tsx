import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillingPlansClient } from "../BillingPlansClient";
import type { BillingPlanView } from "../BillingPlansClient";

const locationReload = vi.fn();

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
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: locationReload, assign: vi.fn() },
      writable: true,
    });
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
    render(
      <BillingPlansClient
        plans={plans}
        currentPlanId="free"
        onNavigate={navigateSpy}
      />,
    );

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
    render(
      <BillingPlansClient
        plans={plans}
        currentPlanId="free"
        onNavigate={navigateSpy}
      />,
    );

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

  it("shows cancel CTA for active paid subscription", () => {
    render(<BillingPlansClient plans={plans} currentPlanId="pro" />);

    expect(screen.getByRole("button", { name: "cancel subscription" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "cancel subscription" })).not.toBeDisabled();
  });

  it("redirects to auth login when checkout returns 401 with redirectUrl", async () => {
    const fetchMock = vi.mocked(fetch);
    const navigateSpy = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthorized", redirectUrl: "/auth/login?next=/billing" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );

    const user = userEvent.setup();
    render(
      <BillingPlansClient
        plans={plans}
        currentPlanId="free"
        onNavigate={navigateSpy}
      />,
    );

    await user.click(screen.getByRole("button", { name: "upgrade to pro" }));

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith("/auth/login?next=/billing");
    });
  });

  it("cancels auto-renew when cancel subscription is clicked", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          planId: "pro",
          cancelAtPeriodEnd: true,
          currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const user = userEvent.setup();
    render(<BillingPlansClient plans={plans} currentPlanId="pro" />);

    await user.click(screen.getByRole("button", { name: "cancel subscription" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/billing/cancel",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(locationReload).toHaveBeenCalled();
  });

  it("resumes auto-renew when current plan is canceled", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          planId: "pro",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const user = userEvent.setup();
    render(
      <BillingPlansClient
        plans={plans}
        currentPlanId="pro"
        cancelAtPeriodEnd={true}
        currentPeriodEnd={new Date(Date.now() + 1000 * 60 * 60).toISOString()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "resume auto-renew" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/billing/resume",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(locationReload).toHaveBeenCalled();
  });
});
