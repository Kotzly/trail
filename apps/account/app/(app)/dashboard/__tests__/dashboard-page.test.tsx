import React from "react";
import { render, screen } from "@testing-library/react";
import { accountCopy } from "@trail/content";
import DashboardPage from "../page";

describe("DashboardPage", () => {
  it("renders dashboard with stats and empty state", () => {
    render(<DashboardPage />);

    // Stats
    expect(screen.getByText("sync")).toBeInTheDocument();
    expect(screen.getByText("sessions")).toBeInTheDocument();
    expect(screen.getByText("trails")).toBeInTheDocument();

    // Empty state
    expect(
      screen.getByText(accountCopy.dashboard.empty.title),
    ).toBeInTheDocument();

    // Quick links
    expect(screen.getByText("extension")).toBeInTheDocument();
    expect(screen.getByText("account")).toBeInTheDocument();
  });
});
