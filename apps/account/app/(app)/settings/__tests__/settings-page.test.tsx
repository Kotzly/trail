import React from "react";
import { render, screen } from "@testing-library/react";

import SettingsPage from "../page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@/src/lib/auth", () => ({
  getAuthSession: async () => ({
    user: { name: "Alex Trail", email: "alex@trail.net", imageUrl: null },
  }),
}));

vi.mock("@/src/auth", () => ({
  auth: {
    api: {
      getSession: async () => ({
        user: { name: "Alex Trail", email: "alex@trail.net", image: null },
      }),
    },
  },
}));

vi.mock("@/src/account-profile", () => ({
  splitDisplayName: (name: string) => {
    const [firstName = "", ...rest] = name.split(" ");
    return { firstName, lastName: rest.join(" ") };
  },
}));

vi.mock("@/app/(app)/SignOutButton", () => ({
  default: () => <button type="button">sign out</button>,
}));

vi.mock("../AccountSettingsForm", () => ({
  AccountSettingsForm: () => <form data-testid="account-settings-form" />,
}));

describe("SettingsPage", () => {
  it("renders settings with inline account form", async () => {
    const node = await SettingsPage();
    render(node);

    expect(screen.getByRole("heading", { name: "settings" })).toBeInTheDocument();
    expect(screen.getByTestId("account-settings-form")).toBeInTheDocument();
  });

  it("does not render manage link", async () => {
    const node = await SettingsPage();
    render(node);

    expect(screen.queryByRole("link", { name: "manage" })).not.toBeInTheDocument();
  });
});
