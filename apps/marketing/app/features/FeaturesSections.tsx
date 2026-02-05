"use client";

import { motion } from "framer-motion";
import { FeaturesCTA } from "./FeaturesCTA";
import { FeaturesGrid } from "./FeaturesGrid";
import { FeaturesHero } from "./FeaturesHero";
import { FeaturesTimeline } from "./FeaturesTimeline";
import {
  MarketingPageShell,
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../shared/marketing-primitives";

function IntegrationsSection() {
  return (
    <PageSection spacing="spacious">
      <SectionContainer size="md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <SurfaceCard className="p-8 text-center md:p-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
              <svg
                className="h-7 w-7 text-accent"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-ink">
              Works where you work
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-ink-muted">
              Trail integrates seamlessly with your browser. No extensions to
              manage, no accounts to configure. Just install and start
              researching.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {["Chrome", "Edge", "Brave", "Firefox (soon)"].map((browser) => (
                <span
                  key={browser}
                  className="rounded-full border border-stroke/60 bg-surface px-4 py-2 text-sm text-ink-muted"
                >
                  {browser}
                </span>
              ))}
            </div>
          </SurfaceCard>
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}

export function FeaturesContent() {
  return (
    <MarketingPageShell>
      <FeaturesHero />
      <FeaturesGrid />
      <IntegrationsSection />
      <FeaturesTimeline />
      <FeaturesCTA />
    </MarketingPageShell>
  );
}
