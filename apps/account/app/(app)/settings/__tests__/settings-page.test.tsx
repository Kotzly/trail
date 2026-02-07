import React from "react";
import { render, screen } from "@testing-library/react";

import SettingsPage from "../page";

const usageMocks = vi.hoisted(() => ({
  getAccountUsageSnapshot: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/src/lib/auth", () => ({
  getAuthSession: async () => ({
    user: { name: "Alex Trail", email: "alex@trail.net", imageUrl: null },
  }),
}));

vi.mock("@/src/server/account-usage", () => ({
  ...usageMocks,
}));

describe("SettingsPage", () => {
  it("renders the settings headers", async () => {
    usageMocks.getAccountUsageSnapshot.mockResolvedValue({
      trailCount: 0,
      activeSessionCount: 0,
      recentTrails: [],
      devices: [],
    });

    const node = await SettingsPage();
    render(node);

    expect(
      screen.getByRole("heading", { name: "settings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("account")).toBeInTheDocument();
  });

  it("uses better auth account settings links", async () => {
    usageMocks.getAccountUsageSnapshot.mockResolvedValue({
      trailCount: 0,
      activeSessionCount: 0,
      recentTrails: [],
      devices: [],
    });

    const node = await SettingsPage();
    render(node);

    const expectedHref = `${process.env.TRAIL_AUTH_BASE_URL}/account`;
    expect(screen.getByRole("link", { name: "manage" })).toHaveAttribute(
      "href",
      expectedHref,
    );
  });

  it("renders active extension sessions when present", async () => {
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

    const node = await SettingsPage();
    render(node);

    expect(screen.getByText("MacBook Pro")).toBeInTheDocument();
    expect(screen.getByText("Chrome on macOS")).toBeInTheDocument();
  });
});
