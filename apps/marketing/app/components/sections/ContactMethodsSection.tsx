"use client";

import { motion } from "motion/react";
import { Mail, HelpCircle, MessageSquare } from "@trail/ui/icons";
import {
  IconChip,
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../../shared/marketing-primitives";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Mail,
  HelpCircle,
  MessageSquare,
};

interface ContactMethodsSectionProps {
  title?: string;
  methods?: {
    title: string;
    email?: string;
    description?: string;
    icon?: string;
  }[];
}

export function ContactMethodsSection({
  methods,
}: ContactMethodsSectionProps) {
  if (!methods?.length) return null;
  return (
    <PageSection spacing="compact">
      <SectionContainer size="lg">
        <div className="grid gap-6 md:grid-cols-3">
          {methods.map((method, index) => {
            const Icon = (method.icon && iconMap[method.icon]) || Mail;
            return (
              <motion.a
                key={method.title}
                href={method.email ? `mailto:${method.email}` : "#"}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
              >
                <SurfaceCard interactive className="group p-6">
                  <IconChip
                    accent
                    className="transition-transform group-hover:scale-110"
                  >
                    <Icon className="h-6 w-6" />
                  </IconChip>
                  <h3 className="mt-4 text-lg font-semibold text-ink">
                    {method.title}
                  </h3>
                  {method.email && (
                    <p className="mt-1 text-sm font-medium text-accent">
                      {method.email}
                    </p>
                  )}
                  {method.description && (
                    <p className="mt-2 text-sm text-ink-muted">
                      {method.description}
                    </p>
                  )}
                </SurfaceCard>
              </motion.a>
            );
          })}
        </div>
      </SectionContainer>
    </PageSection>
  );
}
