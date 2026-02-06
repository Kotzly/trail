import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { OnboardingModal } from "../OnboardingModal";

describe("OnboardingModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("opens onboarding when backend reports user is new", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ seen: false }), { status: 200 }),
      );

    render(<OnboardingModal />);

    expect(await screen.findByText("welcome to trail")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding", {
      cache: "no-store",
    });
  });

  it("keeps onboarding closed when backend reports user is not new", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ seen: true }), { status: 200 }),
    );

    render(<OnboardingModal />);

    await waitFor(() => {
      expect(screen.queryByText("welcome to trail")).not.toBeInTheDocument();
    });
  });
});
