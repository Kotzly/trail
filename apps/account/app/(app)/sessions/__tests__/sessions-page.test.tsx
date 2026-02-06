import React from "react";
import { render, screen } from "@testing-library/react";
import { accountCopy } from "@trail/content";

const usageMocks = vi.hoisted(() => ({
  getAccountUsageSnapshot: vi.fn(),
}));

vi.mock("@/src/server/account-usage", () => ({
  ...usageMocks,
}));

import SessionsPage from "../page";

describe("SessionsPage", () => {
  it("renders the sessions header and empty state", async () => {
    usageMocks.getAccountUsageSnapshot.mockResolvedValue({
      trailCount: 0,
      activeSessionCount: 0,
      devices: [],
      recentTrails: [],
    });

    render(await SessionsPage());

    expect(
      screen.getByRole("heading", { name: accountCopy.sessions.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(accountCopy.sessions.list.emptyTitle),
    ).toBeInTheDocument();
  });

  it("renders connected sessions list", async () => {
    usageMocks.getAccountUsageSnapshot.mockResolvedValue({
      trailCount: 9,
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
          session: null,
        },
      ],
    });

    render(await SessionsPage());

    expect(screen.getByText("MacBook Pro")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(
      screen.queryByText(accountCopy.sessions.list.emptyTitle),
    ).not.toBeInTheDocument();
  });
});
