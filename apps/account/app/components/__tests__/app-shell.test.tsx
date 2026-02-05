import React from "react";
import { render, screen } from "@testing-library/react";

import { AppShell } from "../AppShell";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("AppShell", () => {
  it("renders a skip link and main content", () => {
    render(
      <AppShell>
        <div>main content</div>
      </AppShell>,
    );

    expect(screen.getByText("Skip to main content")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("main content");
  });
});
