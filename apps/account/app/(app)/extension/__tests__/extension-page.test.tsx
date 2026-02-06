import React from "react";
import { render, screen } from "@testing-library/react";

import { accountCopy } from "@trail/content";
import ExtensionPage from "../page";

const usageMocks = vi.hoisted(() => ({
  getAccountUsageSnapshot: vi.fn(),
}));

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

vi.mock("@/src/server/account-usage", () => ({
  ...usageMocks,
}));

describe("ExtensionPage", () => {
  it("renders the extension headers", async () => {
    usageMocks.getAccountUsageSnapshot.mockResolvedValue({
      trailCount: 0,
      activeSessionCount: 0,
      recentTrails: [],
      devices: [],
    });

    const node = await ExtensionPage({ searchParams: Promise.resolve({}) });
    render(node);

    expect(
      screen.getByRole("heading", { name: accountCopy.extension.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(accountCopy.extension.status.title),
    ).toBeInTheDocument();
  });

  it("renders connected device sessions", async () => {
    usageMocks.getAccountUsageSnapshot.mockResolvedValue({
      trailCount: 0,
      activeSessionCount: 1,
      recentTrails: [],
      devices: [
        {
          id: "device-1",
          status: "ACTIVE",
          deviceName: "MacBook Pro",
          browserName: "Chrome",
          os: "macOS",
          lastSeenAt: "2026-02-06T22:45:53.094Z",
          updatedAt: "2026-02-06T22:45:53.094Z",
          session: null,
        },
      ],
    });

    const node = await ExtensionPage({ searchParams: Promise.resolve({}) });
    render(node);

    expect(screen.getAllByText("MacBook Pro").length).toBeGreaterThan(0);
    expect(screen.getAllByText("active").length).toBeGreaterThan(0);
    expect(
      screen.queryByText(accountCopy.extension.empty.title),
    ).not.toBeInTheDocument();
  });
});
