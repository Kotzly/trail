import { render, screen } from "@testing-library/react";
import { PageHeader } from "@trail/ui";

describe("PageHeader", () => {
  it("renders title, subtitle, and actions", () => {
    render(
      <PageHeader
        eyebrow="overview"
        title="account"
        subtitle="manage your trail"
        meta={<span>meta</span>}
        actions={<button type="button">action</button>}
      />,
    );

    expect(screen.getByText("overview")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "account" }),
    ).toBeInTheDocument();
    expect(screen.getByText("manage your trail")).toBeInTheDocument();
    expect(screen.getByTestId("page-header-meta")).toHaveTextContent("meta");
    expect(screen.getByRole("button", { name: "action" })).toBeInTheDocument();
  });
});
