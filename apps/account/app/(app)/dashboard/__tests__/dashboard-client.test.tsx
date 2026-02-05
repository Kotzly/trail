import React from "react";
import { render, screen } from "@testing-library/react";

import { accountCopy } from "@trail/content";
import { DashboardClient } from "../DashboardClient";

vi.mock("@/src/trpc/client", () => ({
  trpc: {
    health: {
      useQuery: () => ({ data: { ok: false } }),
    },
    me: {
      useQuery: () => ({
        data: { user: { name: "Alex Trail", email: "alex@trail.net" } },
      }),
    },
  },
}));

describe("DashboardClient", () => {
  it("renders empty state and status fallback", () => {
    render(<DashboardClient />);

    expect(
      screen.getByText(accountCopy.dashboard.empty.title),
    ).toBeInTheDocument();
    expect(
      screen.getByText(accountCopy.dashboard.status.lastSyncFallback),
    ).toBeInTheDocument();
  });
});
