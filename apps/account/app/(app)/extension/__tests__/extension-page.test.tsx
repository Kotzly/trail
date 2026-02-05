import React from "react";
import { render, screen } from "@testing-library/react";

import { accountCopy } from "@trail/content";
import ExtensionPage from "../page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/src/lib/auth", () => ({
  getAuthSession: async () => ({
    user: { name: "Alex Trail", email: "alex@trail.net" },
  }),
}));

vi.mock("@/src/server/user", () => ({
  ensureUser: async () => ({ id: "user_1" }),
}));

vi.mock("@/src/server/extension-login", () => ({
  createExtensionLoginCode: async () => "CODE123",
}));

describe("ExtensionPage", () => {
  it("renders the extension headers", async () => {
    const node = await ExtensionPage({ searchParams: Promise.resolve({}) });
    render(node);

    expect(
      screen.getByRole("heading", { name: accountCopy.extension.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(accountCopy.extension.status.title),
    ).toBeInTheDocument();
  });
});
