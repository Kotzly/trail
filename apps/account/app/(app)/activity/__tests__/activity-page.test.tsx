import React from "react";
import { render, screen } from "@testing-library/react";
import { accountCopy } from "@trail/content";

const usageMocks = vi.hoisted(() => ({
  getAccountUsageSnapshot: vi.fn(),
}));

vi.mock("@/src/server/account-usage", () => ({
  ...usageMocks,
}));

import ActivityPage from "../page";

describe("ActivityPage", () => {
  it("renders the activity header and empty state", async () => {
    usageMocks.getAccountUsageSnapshot.mockResolvedValue({
      trailCount: 0,
      activeSessionCount: 0,
      recentTrails: [],
      devices: [],
    });

    render(await ActivityPage());

    expect(
      screen.getByRole("heading", { name: accountCopy.activity.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(accountCopy.activity.empty.title),
    ).toBeInTheDocument();
  });

  it("renders recent activity list", async () => {
    usageMocks.getAccountUsageSnapshot.mockResolvedValue({
      trailCount: 2,
      activeSessionCount: 1,
      devices: [],
      recentTrails: [
        {
          id: "trail-1",
          label: "Research",
          rootTitle: "Docs",
          savedAt: "2026-02-06T22:42:51.989Z",
          nodeCount: 16,
        },
      ],
    });

    render(await ActivityPage());

    expect(screen.getByText("Research")).toBeInTheDocument();
    expect(screen.getByText("Docs • 16 nodes")).toBeInTheDocument();
    expect(
      screen.queryByText(accountCopy.activity.empty.title),
    ).not.toBeInTheDocument();
  });
});
