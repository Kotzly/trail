"use client";

import { motion } from "motion/react";
import { ArrowRight, Clock, LifeBuoy, Mail, MessageSquare } from "lucide-react";
import { Button } from "@trail/ui";
import { SupportFlow } from "./SupportFlow";
import {
  HeroBadge,
  HeroSubtitle,
  HeroTitle,
  IconChip,
  MarketingPageShell,
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../shared/marketing-primitives";

const supportOptions = [
  {
    icon: MessageSquare,
    title: "Contact Support",
    description:
      "Get help from our team via email. We typically respond within 24 hours.",
    action: "Email Us",
    href: "mailto:support@gettrail.net",
    primary: true,
  },
  {
    icon: Clock,
    title: "Response Times",
    description: "Free plan: 24-48 hours. Pro: 12 hours. Team: 4 hours.",
    action: "View FAQ",
    href: "/faq",
    primary: false,
  },
  {
    icon: Mail,
    title: "Feature Requests",
    description:
      "Have an idea? We'd love to hear it. Submit your feature request.",
    action: "Submit Idea",
    href: "mailto:hello@gettrail.net?subject=Feature%20Request",
    primary: false,
  },
] as const;

const quickLinks = [
  {
    title: "Getting Started",
    desc: "Installation and setup guides",
    href: "/downloads",
  },
  {
    title: "Billing",
    desc: "Manage your subscription",
    href: "/pricing",
  },
  {
    title: "Privacy",
    desc: "How we handle your data",
    href: "/faq",
  },
  {
    title: "Contact",
    desc: "Reach our team directly",
    href: "/contact",
  },
] as const;

function SupportHeroSection() {
  return (
    <PageSection spacing="hero">
      <SectionContainer size="md" className="text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <HeroBadge>
            <LifeBuoy className="h-3.5 w-3.5" />
            Support
          </HeroBadge>
          <HeroTitle className="md:text-5xl lg:text-5xl">How can we help?</HeroTitle>
          <HeroSubtitle>
            Get unstuck with support tools, troubleshooting guides, and direct
            help from our team.
          </HeroSubtitle>
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}

function SupportOptionsSection() {
  return (
    <PageSection spacing="compact">
      <SectionContainer size="lg">
        <div className="grid gap-6 md:grid-cols-3">
          {supportOptions.map((option, index) => {
            const Icon = option.icon;
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
                  <h3 className="mt-4 text-lg font-semibold text-ink">{option.title}</h3>
                  <p className="mt-2 text-sm text-ink-muted">{option.description}</p>
                  <Button.AsChild
                    variant={option.primary ? "primary" : "outline"}
                    className="mt-4 w-full"
                  >
                    <a href={option.href} className="flex items-center justify-center">
                      {option.action}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button.AsChild>
                </SurfaceCard>
              </motion.div>
            );
          })}
        </div>
      </SectionContainer>
    </PageSection>
  );
}

function SupportFlowSection() {
  return (
    <PageSection spacing="default">
      <SectionContainer size="md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <SupportFlow />
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}

function SupportQuickLinksSection() {
  return (
    <PageSection spacing="default">
      <SectionContainer size="lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          {quickLinks.map((link) => (
            <a
              key={link.title}
              href={link.href}
              className="group rounded-2xl border border-stroke/40 bg-surface/30 p-5 transition-all hover:border-accent/30 hover:bg-surface/50"
            >
              <h3 className="font-medium text-ink group-hover:text-accent">{link.title}</h3>
              <p className="mt-1 text-sm text-ink-subtle">{link.desc}</p>
            </a>
          ))}
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}

export function SupportContent() {
  return (
    <MarketingPageShell>
      <SupportHeroSection />
      <SupportOptionsSection />
      <SupportFlowSection />
      <SupportQuickLinksSection />
    </MarketingPageShell>
  );
}
