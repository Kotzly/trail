"use client";

import { motion } from "motion/react";
import { ArrowRight, MessageSquare, Clock, Mail } from "@trail/ui/icons";
import { Button } from "@trail/ui";
import {
  IconChip,
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../../shared/marketing-primitives";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare,
  Clock,
  Mail,
};

interface SupportOptionsSectionProps {
  title?: string;
  options?: {
    title: string;
    description?: string;
    icon?: string;
    action?: string;
    href?: string;
    primary?: boolean;
  }[];
}

export function SupportOptionsSection({
  options,
}: SupportOptionsSectionProps) {
  if (!options?.length) return null;
  return (
    <PageSection spacing="compact">
      <SectionContainer size="lg">
        <div className="grid gap-6 md:grid-cols-3">
          {options.map((option, index) => {
            const Icon = (option.icon && iconMap[option.icon]) || MessageSquare;
            return (
              <motion.div
                key={option.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
              >
                <SurfaceCard interactive className="group p-6">
                  <IconChip accent={option.primary}>
                    <Icon className="h-6 w-6" />
                  </IconChip>
                  <h3 className="mt-4 text-lg font-semibold text-ink">
                    {option.title}
                  </h3>
                  {option.description && (
                    <p className="mt-2 text-sm text-ink-muted">
                      {option.description}
                    </p>
                  )}
                  {option.action && option.href && (
                    <Button.AsChild
                      variant={option.primary ? "primary" : "outline"}
                      className="mt-4 w-full"
                    >
                      <a
                        href={option.href}
                        className="flex items-center justify-center"
                      >
                        {option.action}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button.AsChild>
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
