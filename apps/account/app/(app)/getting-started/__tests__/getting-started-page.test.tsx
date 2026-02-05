import React from "react";
import { render, screen } from "@testing-library/react";
import { accountCopy } from "@trail/content";
import GettingStartedPage from "../page";

describe("GettingStartedPage", () => {
  it("renders the checklist and header", () => {
    render(<GettingStartedPage />);

    expect(
      screen.getByRole("heading", { name: accountCopy.gettingStarted.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(accountCopy.gettingStarted.stepsTitle),
    ).toBeInTheDocument();
  });
});
