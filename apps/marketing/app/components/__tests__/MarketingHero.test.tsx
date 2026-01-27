import { render, screen } from "@testing-library/react";
import { MarketingHero } from "../MarketingHero";

describe("MarketingHero", () => {
  it("renders the main headline", () => {
    render(<MarketingHero />);
    expect(
      screen.getByText(/Trail turns messy tab sessions into structured trails/i)
    ).toBeInTheDocument();
  });
});
