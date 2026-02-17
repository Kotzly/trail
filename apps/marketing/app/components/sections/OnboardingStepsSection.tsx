"use client";

import { motion } from "motion/react";
import { Download, CheckCircle2, Sparkles } from "@trail/ui/icons";
import {
  IconChip,
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../../shared/marketing-primitives";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Download,
  CheckCircle2,
  Sparkles,
};

interface OnboardingStepsSectionProps {
  eyebrow?: string;
  title?: string;
  steps?: { title: string; description?: string; icon?: string }[];
}

export function OnboardingStepsSection({
  eyebrow,
  title,
  steps,
}: OnboardingStepsSectionProps) {
  if (!steps?.length) return null;
  return (
    <PageSection spacing="spacious">
      <SectionContainer size="lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          {eyebrow && (
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">
              {eyebrow}
            </span>
          )}
          {title && (
            <h2 className="mt-4 text-2xl font-semibold text-ink md:text-3xl">
              {title}
            </h2>
          )}
        </motion.div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = (step.icon && iconMap[step.icon]) || Sparkles;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <SurfaceCard className="p-6">
                  <IconChip accent>
                    <Icon className="h-6 w-6" />
                  </IconChip>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                      {index + 1}
                    </span>
                    <h3 className="font-semibold text-ink">{step.title}</h3>
                  </div>
                  {step.description && (
                    <p className="mt-2 text-sm text-ink-muted">
                      {step.description}
                    </p>
                  )}
                </SurfaceCard>
              </motion.div>
            );
          })}
        </div>
      </SectionContainer>
    </PageSection>
  );
}
