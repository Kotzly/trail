import React from "react";
import { render, screen } from "@testing-library/react";
import BillingPage from "../page";

describe("BillingPage", () => {
  it("renders plan cards with toggle", () => {
    render(<BillingPage />);

    expect(screen.getAllByText("free").length).toBeGreaterThan(0);
    expect(screen.getByText("pro")).toBeInTheDocument();
    expect(screen.getByText("team")).toBeInTheDocument();
    expect(screen.getByText("monthly")).toBeInTheDocument();
    expect(screen.getByText("yearly")).toBeInTheDocument();
  });
});
