import React from "react";
import { render, screen } from "@testing-library/react";

const usageMocks = vi.hoisted(() => ({
  getAccountUsageSnapshot: vi.fn(),
}));

vi.mock("@/src/server/account-usage", () => ({
  ...usageMocks,
}));

import DashboardPage from "../page";

describe("DashboardPage", () => {
  it("renders recent trails table", async () => {
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

    expect(screen.getByRole("heading", { name: "trails" })).toBeInTheDocument();
    expect(screen.getByText("recent")).toBeInTheDocument();
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("root")).toBeInTheDocument();
    expect(screen.getByText("nodes")).toBeInTheDocument();
    expect(screen.getByText("saved")).toBeInTheDocument();
    expect(screen.getByText("testing tree")).toBeInTheDocument();
    expect(screen.getByText("New Tab")).toBeInTheDocument();
  });

  it("renders empty state when no trails exist", async () => {
    usageMocks.getAccountUsageSnapshot.mockResolvedValue({
      trailCount: 0,
      activeSessionCount: 0,
      devices: [],
      recentTrails: [],
    });

    render(await DashboardPage());

    expect(screen.getByText("no trails yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "connect extension" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "account" })).toBeInTheDocument();
  });
});
