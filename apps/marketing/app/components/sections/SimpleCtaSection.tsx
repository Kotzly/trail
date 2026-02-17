"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "@trail/ui/icons";
import { Button } from "@trail/ui";
import { GlowingEffect } from "../ui/glowing-effect";
import {
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../../shared/marketing-primitives";

interface SimpleCtaSectionProps {
  title: string;
  description?: string;
  primaryCta?: { text: string; href: string };
  secondaryCta?: { text: string; href: string };
}

export function SimpleCtaSection({
  title,
  description,
  primaryCta,
  secondaryCta,
}: SimpleCtaSectionProps) {
  return (
    <PageSection spacing="spacious">
      <SectionContainer size="md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <SurfaceCard className="relative overflow-hidden bg-surface/70 p-8 text-center md:p-12">
            <GlowingEffect
              spread={60}
              glow={true}
              disabled={false}
              proximity={80}
              inactiveZone={0.01}
              borderWidth={2}
            />
            <div className="relative">
              <h2 className="text-2xl font-semibold text-ink md:text-3xl">
                {title}
              </h2>
              {description && (
                <p className="mx-auto mt-3 max-w-lg text-ink-muted">
                  {description}
                </p>
              )}
              {(primaryCta || secondaryCta) && (
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  {primaryCta && (
                    <Button.AsChild size="lg" className="w-full sm:w-auto">
                      <Link href={primaryCta.href}>
                        {primaryCta.text}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button.AsChild>
                  )}
                  {secondaryCta && (
                    <Button.AsChild
                      variant="outline"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      <Link href={secondaryCta.href}>
                        {secondaryCta.text}
                      </Link>
                    </Button.AsChild>
                  )}
                </div>
              )}
            </div>
          </SurfaceCard>
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}
