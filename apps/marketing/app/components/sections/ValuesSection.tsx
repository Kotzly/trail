"use client";

import { motion } from "motion/react";
import { Shield, Zap, Users, Heart } from "@trail/ui/icons";
import {
  IconChip,
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../../shared/marketing-primitives";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield,
  Zap,
  Users,
  Heart,
};

interface ValuesSectionProps {
  title?: string;
  values?: { title: string; description: string; icon?: string }[];
}

export function ValuesSection({ title, values }: ValuesSectionProps) {
  if (!values?.length) return null;
  return (
    <PageSection spacing="spacious">
      <SectionContainer size="lg">
        {title && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-2xl font-semibold text-ink md:text-3xl">
              {title}
            </h2>
          </motion.div>
        )}
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {values.map((value, index) => {
            const Icon = (value.icon && iconMap[value.icon]) || Heart;
            return (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <SurfaceCard interactive className="group p-6">
                  <IconChip
                    accent
                    className="transition-transform group-hover:scale-110"
                  >
                    <Icon className="h-6 w-6" />
                  </IconChip>
                  <h3 className="mt-4 text-lg font-semibold text-ink">
                    {value.title}
                  </h3>
                  <p className="mt-2 text-sm text-ink-muted">
                    {value.description}
                  </p>
                </SurfaceCard>
              </motion.div>
            );
          })}
        </div>
      </SectionContainer>
    </PageSection>
  );
}
