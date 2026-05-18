import dynamic from "next/dynamic";
import { getTranslations } from "next-intl/server";
import { LandingHero } from "./Hero";
import { LandingFeatures } from "./Features";
import { LandingCta } from "./Cta";
import { INSTALL_URL } from "@/lib/install-url";

// Below-the-fold, motion-heavy interactive demo: ship as its own
// chunk so it doesn't block the hero on slow networks.
const LandingDemo = dynamic(
  () => import("./Demo").then((m) => ({ default: m.LandingDemo })),
  {
    loading: () => (
      <div
        aria-hidden="true"
        style={{ minHeight: "100vh", background: "var(--landing-bg)" }}
      />
    ),
  },
);

export async function LandingPage() {
  const t = await getTranslations("landing");
  return (
    <div data-landing className="relative">
      {/* Single canonical H1 for SEO and screen readers — ensures the
          page has a heading even after the hero swaps from static
          (h2-styled headline) to the cinematic version (act h2s) on
          desktop. Visually hidden but present in the accessibility tree. */}
      <h1 className="sr-only">{t("srHeading")}</h1>
      <LandingHero />
      <LandingFeatures />
      <LandingDemo />
      <LandingCta ctaHref={INSTALL_URL} />
    </div>
  );
}
