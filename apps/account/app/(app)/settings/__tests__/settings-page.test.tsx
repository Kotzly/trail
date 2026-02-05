import React from "react";
import { render, screen } from "@testing-library/react";

import { accountCopy } from "@trail/content";
import SettingsPage from "../page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/src/lib/auth", () => ({
  getAuthSession: async () => ({
    user: { name: "Alex Trail", email: "alex@trail.net", imageUrl: null },
  }),
}));

describe("SettingsPage", () => {
  it("renders the settings headers", async () => {
    const node = await SettingsPage();
    render(node);

    expect(
      screen.getByRole("heading", { name: accountCopy.settings.title }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(accountCopy.settings.profile.title)[0],
    ).toBeInTheDocument();
  });
});
