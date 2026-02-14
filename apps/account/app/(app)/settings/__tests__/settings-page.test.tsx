import React from "react";
import { render, screen } from "@testing-library/react";

import SettingsPage from "../page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/src/lib/auth", () => ({
  getAuthSession: async () => ({
    user: { name: "Alex Trail", email: "alex@trail.net", imageUrl: null },
  }),
}));

vi.mock("@/app/(app)/SignOutButton", () => ({
  default: () => <button type="button">sign out</button>,
}));

describe("SettingsPage", () => {
  it("renders settings with local manage link", async () => {
    const node = await SettingsPage();
    render(node);

    expect(screen.getByRole("heading", { name: "settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "manage" })).toHaveAttribute(
      "href",
      "/auth/account",
    );
  });

  it("does not render sessions manager", async () => {
    const node = await SettingsPage();
    render(node);

    expect(screen.queryByText("sessions")).not.toBeInTheDocument();
  });
});
