import React from "react";
import { render, screen } from "@testing-library/react";
import { accountCopy } from "@trail/content";
import SessionsPage from "../page";

describe("SessionsPage", () => {
  it("renders the sessions header and empty state", () => {
    render(<SessionsPage />);

    expect(
      screen.getByRole("heading", { name: accountCopy.sessions.title })
    ).toBeInTheDocument();
    expect(screen.getByText(accountCopy.sessions.list.emptyTitle)).toBeInTheDocument();
  });
});
