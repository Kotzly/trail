"use client";

import { motion } from "motion/react";
import {
  MousePointerClick,
  Search,
  GitBranch,
  Share2,
  FileDown,
  Shield,
} from "@trail/ui/icons";
import {
  IconChip,
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../../shared/marketing-primitives";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MousePointerClick,
  Search,
  GitBranch,
  Share2,
  FileDown,
  Shield,
};

interface FeaturesGridSectionProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  features?: { name: string; description?: string; icon?: string; highlight?: string }[];
}

export function FeaturesGridSection({
  eyebrow,
  title,
  subtitle,
  features,
}: FeaturesGridSectionProps) {
  if (!features?.length) return null;
  return (
    <PageSection spacing="spacious">
      <SectionContainer size="lg">
        {(eyebrow || title) && (
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
            {subtitle && (
              <p className="mx-auto mt-4 max-w-2xl text-ink-muted">
                {subtitle}
              </p>
            )}
          </motion.div>
        )}
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon =
              (feature.icon && iconMap[feature.icon]) || MousePointerClick;
            return (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
              >
                <SurfaceCard interactive className="group p-6">
                  <IconChip
                    accent
                    className="transition-transform group-hover:scale-110"
                  >
                    <Icon className="h-6 w-6" />
                  </IconChip>
                  <h3 className="mt-4 text-lg font-semibold text-ink">
                    {feature.name}
                  </h3>
                  {feature.description && (
                    <p className="mt-2 text-sm text-ink-muted">
                      {feature.description}
                    </p>
                  )}
                  {feature.highlight && (
                    <p className="mt-3 text-xs font-medium text-accent">
                      {feature.highlight}
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
