"use client";

import { motion } from "motion/react";
import { ArrowRight, HelpCircle, CreditCard, Shield, Download, Mail } from "@trail/ui/icons";
import {
  IconChip,
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../../shared/marketing-primitives";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  HelpCircle,
  CreditCard,
  Shield,
  Download,
  Mail,
  ArrowRight,
};

interface QuickLinksSectionProps {
  title?: string;
  links?: {
    title: string;
    description?: string;
    href: string;
    icon?: string;
  }[];
}

export function QuickLinksSection({ title, links }: QuickLinksSectionProps) {
  if (!links?.length) return null;
  return (
    <PageSection spacing="compact">
      <SectionContainer size="lg">
        {title && (
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-6 text-center text-lg font-semibold text-ink"
          >
            {title}
          </motion.h3>
        )}
        <div
          className={`grid gap-4 ${links.length <= 3 ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"}`}
        >
          {links.map((link, index) => {
            const Icon = (link.icon && iconMap[link.icon]) || ArrowRight;
            return (
              <motion.a
                key={link.href}
                href={link.href}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
              >
                <SurfaceCard interactive className="group p-5">
                  <div className="flex items-start gap-3">
                    <IconChip accent className="shrink-0 transition-transform group-hover:scale-110">
                      <Icon className="h-5 w-5" />
                    </IconChip>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-ink">{link.title}</h4>
                      {link.description && (
                        <p className="mt-1 text-sm text-ink-muted">
                          {link.description}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-1" />
                  </div>
                </SurfaceCard>
              </motion.a>
            );
          })}
        </div>
      </SectionContainer>
    </PageSection>
  );
}
