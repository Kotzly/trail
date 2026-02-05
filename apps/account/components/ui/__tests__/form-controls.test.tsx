import { render, screen } from "@testing-library/react";
import { Field, Input, Label, FormMessage, Textarea } from "@trail/ui";

describe("Form controls", () => {
  it("wires label and input", () => {
    render(
      <Field>
        <Label htmlFor="email">Email</Label>
        <Input id="email" placeholder="name@trail.dev" />
        <FormMessage>Required</FormMessage>
      </Field>
    );

    expect(screen.getByText("Email")).toHaveAttribute("for", "email");
    expect(screen.getByPlaceholderText("name@trail.dev")).toBeInTheDocument();
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("renders textarea", () => {
    render(<Textarea placeholder="Notes" />);
    expect(screen.getByPlaceholderText("Notes")).toBeInTheDocument();
  });
});
