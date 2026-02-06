import React from "react";
import { render, screen } from "@testing-library/react";
import { accountCopy } from "@trail/content";

const usageMocks = vi.hoisted(() => ({
  getAccountUsageSnapshot: vi.fn(),
}));

vi.mock("@/src/server/account-usage", () => ({
  ...usageMocks,
}));

import DashboardPage from "../page";

describe("DashboardPage", () => {
  it("renders dashboard with synced stats", async () => {
    usageMocks.getAccountUsageSnapshot.mockResolvedValue({
      trailCount: 9,
      activeSessionCount: 1,
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
      recentTrails: [
        {
          id: "trail-1",
          label: "testing tree",
          rootTitle: "New Tab",
          savedAt: "2026-02-06T22:42:51.989Z",
          nodeCount: 1367,
        },
      ],
    });

    render(await DashboardPage());

    // Stats
    expect(screen.getByText("sync")).toBeInTheDocument();
    expect(screen.getByText("sessions")).toBeInTheDocument();
    expect(screen.getByText("trails")).toBeInTheDocument();
    expect(screen.getByText("online")).toBeInTheDocument();
    expect(screen.getByText("1 active")).toBeInTheDocument();
    expect(screen.getAllByText("9 captured").length).toBeGreaterThan(0);
    expect(screen.getByText("testing tree")).toBeInTheDocument();

    expect(
      screen.queryByText(accountCopy.dashboard.empty.title),
    ).not.toBeInTheDocument();
  });

  it("renders empty state when no trails exist", async () => {
    usageMocks.getAccountUsageSnapshot.mockResolvedValue({
      trailCount: 0,
      activeSessionCount: 0,
      devices: [],
      recentTrails: [],
    });

    render(await DashboardPage());

    expect(screen.getByText("offline")).toBeInTheDocument();
    expect(screen.getByText("0 active")).toBeInTheDocument();
    expect(screen.getByText("0 captured")).toBeInTheDocument();
    expect(screen.getByText(accountCopy.dashboard.empty.title)).toBeInTheDocument();

    // Quick links
    expect(screen.getByText("extension")).toBeInTheDocument();
    expect(screen.getByText("account")).toBeInTheDocument();
  });
});
