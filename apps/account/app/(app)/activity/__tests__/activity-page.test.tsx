import React from "react";
import { render, screen } from "@testing-library/react";
import { accountCopy } from "@trail/content";
import ActivityPage from "../page";

describe("ActivityPage", () => {
  it("renders the activity header and empty state", () => {
    render(<ActivityPage />);

    expect(
      screen.getByRole("heading", { name: accountCopy.activity.title })
    ).toBeInTheDocument();
    expect(screen.getByText(accountCopy.activity.empty.title)).toBeInTheDocument();
  });
});
