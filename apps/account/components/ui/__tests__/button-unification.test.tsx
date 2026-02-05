import { render, screen } from "@testing-library/react";
import { Button } from "@trail/ui";

describe("Button", () => {
  it("renders variants and sizes", () => {
    render(
      <div>
        <Button variant="primary">Primary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="subtle">Subtle</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button size="icon" aria-label="Icon" />
      </div>
    );

    expect(screen.getByText("Primary")).toHaveClass("bg-cta");
    expect(screen.getByText("Outline")).toHaveClass("border");
    expect(screen.getByText("Ghost")).toHaveClass("bg-transparent");
    expect(screen.getByText("Subtle")).toHaveClass("bg-surface");
    expect(screen.getByText("Small")).toHaveClass("h-9");
    expect(screen.getByText("Large")).toHaveClass("h-12");
    expect(screen.getByLabelText("Icon")).toHaveClass("h-9");
  });
});
