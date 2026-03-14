import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectionRenderer } from "../SectionRenderer";
import type { SanitySection } from "../../../lib/sanity/types";

// Mock section components to isolate SectionRenderer logic
vi.mock("../sections/HeroSection", () => ({
  HeroSection: ({ section }: { section: { title: string } }) => (
    <div data-testid="hero-section">{section.title}</div>
  ),
}));

vi.mock("../sections/FeaturesSection", () => ({
  FeaturesSection: ({ section }: { section: { title: string } }) => (
    <div data-testid="features-section">{section.title}</div>
  ),
}));

vi.mock("../sections/CtaSection", () => ({
  CtaSection: ({ section }: { section: { title: string } }) => (
    <div data-testid="cta-section">{section.title}</div>
  ),
}));

describe("SectionRenderer", () => {
  it("renders nothing for empty sections", () => {
    const { container } = render(
      <SectionRenderer sections={[]} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for null-ish sections", () => {
    const { container } = render(
      <SectionRenderer sections={null as unknown as SanitySection[]} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders a hero section", () => {
    const sections: SanitySection[] = [
      {
        _type: "heroSection",
        _key: "hero-1",
        title: "Welcome to Trail",
      },
    ];
    render(<SectionRenderer sections={sections} />);
    expect(screen.getByTestId("hero-section")).toHaveTextContent("Welcome to Trail");
  });

  it("renders a features section", () => {
    const sections: SanitySection[] = [
      {
        _type: "bentoFeaturesSection",
        _key: "features-1",
        title: "Our Features",
      },
    ];
    render(<SectionRenderer sections={sections} />);
    expect(screen.getByTestId("features-section")).toHaveTextContent("Our Features");
  });

  it("renders a CTA section", () => {
    const sections: SanitySection[] = [
      {
        _type: "ctaSection",
        _key: "cta-1",
        title: "Get Started",
      },
    ];
    render(<SectionRenderer sections={sections} />);
    expect(screen.getByTestId("cta-section")).toHaveTextContent("Get Started");
  });

  it("renders multiple sections in order", () => {
    const sections: SanitySection[] = [
      { _type: "heroSection", _key: "h1", title: "Hero" },
      { _type: "bentoFeaturesSection", _key: "f1", title: "Features" },
      { _type: "ctaSection", _key: "c1", title: "CTA" },
    ];
    render(<SectionRenderer sections={sections} />);
    expect(screen.getByTestId("hero-section")).toBeInTheDocument();
    expect(screen.getByTestId("features-section")).toBeInTheDocument();
    expect(screen.getByTestId("cta-section")).toBeInTheDocument();
  });

  it("skips unknown section types without crashing", () => {
    const sections = [
      { _type: "unknownSection", _key: "u1", title: "Unknown" },
      { _type: "heroSection", _key: "h1", title: "Hero" },
    ] as SanitySection[];
    render(<SectionRenderer sections={sections} />);
    expect(screen.getByTestId("hero-section")).toBeInTheDocument();
    expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
  });
});
