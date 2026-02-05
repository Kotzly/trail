import React from "react";
import { render, screen } from "@testing-library/react";
import { accountCopy } from "@trail/content";
import { AppSidebar } from "../Sidebar";

// Мокаем usePathname
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard"
}));

describe("AppSidebar", () => {
  it("renders nav links", () => {
    render(<AppSidebar />);

    // Проверяем что ссылки есть (по aria-label)
    expect(screen.getByText(accountCopy.brand.name)).toBeInTheDocument();
    expect(screen.getByText(accountCopy.nav.dashboard)).toBeInTheDocument();
    expect(screen.getByText(accountCopy.nav.activity)).toBeInTheDocument();
    expect(screen.getByText(accountCopy.nav.settings)).toBeInTheDocument();
    expect(screen.getByText(accountCopy.nav.signOut)).toBeInTheDocument();
  });
});
