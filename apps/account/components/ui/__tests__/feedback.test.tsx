import { render, screen } from "@testing-library/react";
import { Callout, EmptyState, Skeleton } from "@trail/ui";

describe("Feedback components", () => {
  it("renders callout", () => {
    render(<Callout tone="warning" title="Heads up">Check settings</Callout>);
    expect(screen.getByText("Heads up")).toBeInTheDocument();
    expect(screen.getByText("Check settings")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<EmptyState title="Nothing here" description="Create one" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders skeleton", () => {
    render(<Skeleton className="h-6" />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });
});
