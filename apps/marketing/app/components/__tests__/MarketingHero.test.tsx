import { render, screen } from "@testing-library/react";
import { marketingCopy } from "@trail/content";
import { MarketingHero } from "../MarketingHero";

describe("MarketingHero", () => {
  it("renders the main headline", () => {
    render(<MarketingHero />);
    expect(
      screen.getByText(new RegExp(marketingCopy.hero.lead, "i"))
    ).toBeInTheDocument();
  });
});
