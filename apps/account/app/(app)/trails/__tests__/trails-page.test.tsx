import React from "react";
import { render, screen } from "@testing-library/react";

const authMocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
}));

const trailsMocks = vi.hoisted(() => ({
  getTrailsList: vi.fn(),
}));

vi.mock("@/src/lib/auth", () => authMocks);
vi.mock("@/src/server/trails", () => trailsMocks);
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("../trails-client", () => ({
  TrailsClient: ({ trails }: { trails: { id: string; label: string; nodeCount: number; rootTitle?: string | null; savedAt: string }[] }) => (
    <div data-testid="trails-client">
      {trails.map((t) => (
        <div key={t.id}>
          <span>{t.label}</span>
          <span>{t.rootTitle}</span>
          <span>{t.nodeCount} nodes</span>
        </div>
      ))}
      {trails.length === 0 && <span>No trails yet</span>}
    </div>
  ),
}));

import TrailsPage from "../page";

describe("TrailsPage", () => {
  beforeEach(() => {
    authMocks.getAuthSession.mockResolvedValue({
      user: { id: "u1", email: "a@b.c", name: "Test" },
    });
  });

  it("renders trail cards when trails exist", async () => {
    trailsMocks.getTrailsList.mockResolvedValue({
      items: [
        {
          id: "trail-1",
          label: "testing tree",
          labelSource: "auto",
          rootTitle: "New Tab",
          rootUrl: "https://example.com",
          rootFavicon: null,
          savedAt: "2026-02-06T22:42:51.989Z",
          nodeCount: 1367,
          createdAt: "2026-02-06T22:40:00.000Z",
          updatedAt: "2026-02-06T22:42:51.989Z",
          deviceId: "d1",
        },
      ],
      nextCursor: null,
      totalCount: 1,
    });

    render(await TrailsPage());

    expect(
      screen.getByRole("heading", { name: "Trails" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 saved trail")).toBeInTheDocument();
    expect(screen.getByText("testing tree")).toBeInTheDocument();
    expect(screen.getByText("New Tab")).toBeInTheDocument();
    expect(screen.getByText("1367 nodes")).toBeInTheDocument();
  });

  it("renders empty state when no trails exist", async () => {
    trailsMocks.getTrailsList.mockResolvedValue({
      items: [],
      nextCursor: null,
      totalCount: 0,
    });

    render(await TrailsPage());

    expect(screen.getByText("No trails yet")).toBeInTheDocument();
  });
});
