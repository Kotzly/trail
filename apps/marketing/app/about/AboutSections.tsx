"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  Globe,
  Heart,
  Shield,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@trail/ui";
import { GlowingEffect } from "../components/ui/glowing-effect";
import {
  IconChip,
  MarketingPageShell,
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../shared/marketing-primitives";

const values = [
  {
    icon: Shield,
    title: "Privacy First",
    description:
      "Your data belongs to you. We capture only what's necessary and never sell your information.",
  },
  {
    icon: Zap,
    title: "Speed Matters",
    description:
      "Research tools should be fast. Trail stays out of your way and captures without slowing you down.",
  },
  {
    icon: Users,
    title: "Built for Teams",
    description:
      "Research is collaborative. Trail makes sharing context as easy as sharing a link.",
  },
  {
    icon: Heart,
    title: "User Obsessed",
    description:
      "We use Trail every day. Every feature is built to solve real problems we face ourselves.",
  },
];

const stats = [
  { value: "10K+", label: "Active Researchers" },
  { value: "500K+", label: "Trails Created" },
  { value: "2M+", label: "Sources Captured" },
  { value: "150+", label: "Countries" },
];

function AboutHeroSection() {
  return (
    <PageSection spacing="hero">
      <SectionContainer size="lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-accent">
            About Us
          </span>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.15] tracking-tight text-ink md:text-5xl lg:text-6xl">
            Built for researchers,
            <br />
            by researchers
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-muted">
            Trail started with a simple idea: research should be organized, not
            chaotic. We&apos;re building the tool we wished we had.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-16 grid grid-cols-2 gap-6 md:grid-cols-4"
        >
          {stats.map((stat) => (
            <SurfaceCard key={stat.label} className="p-6 text-center">
              <div className="text-3xl font-bold text-ink md:text-4xl">
                {stat.value}
              </div>
              <div className="mt-1 text-sm text-ink-subtle">{stat.label}</div>
            </SurfaceCard>
          ))}
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}

function MissionSection() {
  return (
    <PageSection spacing="spacious">
      <SectionContainer size="md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-stroke/40 bg-surface/70 p-8 md:p-12"
        >
          <GlowingEffect
            spread={60}
            glow={true}
            disabled={false}
            proximity={80}
            inactiveZone={0.01}
            borderWidth={2}
          />

          <div className="relative text-center">
            <IconChip accent className="mx-auto h-14 w-14">
              <Target className="h-7 w-7" />
            </IconChip>
            <h2 className="mt-6 text-2xl font-semibold text-ink md:text-3xl">
              Our Mission
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted">
              To make research transparent, reproducible, and collaborative. We
              believe the best decisions are made when everyone can see the
              path that led there.
            </p>
          </div>
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}

function ValuesSection() {
  return (
    <PageSection spacing="spacious">
      <SectionContainer size="lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="text-2xl font-semibold text-ink md:text-3xl">
            What we believe
          </h2>
        </motion.div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {values.map((value, index) => {
            const Icon = value.icon;
            return (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <SurfaceCard interactive className="group p-6">
                  <IconChip accent className="transition-transform group-hover:scale-110">
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

function StorySection() {
  return (
    <PageSection spacing="spacious">
      <SectionContainer size="md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <SurfaceCard className="p-8 md:p-12">
            <h2 className="text-2xl font-semibold text-ink">Our Story</h2>
            <div className="mt-6 space-y-4 text-ink-muted">
              <p>
                Trail was born from frustration. As researchers and product
                managers, we were tired of losing track of sources, repeating
                searches, and struggling to share context with teammates.
                Browser history was a mess, bookmarks were insufficient, and
                screenshots lacked the narrative that explained why a source
                mattered.
              </p>
              <p>
                We built Trail to solve our own problem. The first version was
                a simple browser extension that captured our paths as we
                researched. It quickly became indispensable — we couldn&apos;t
                imagine going back to the chaos of tabs and lost sources.
              </p>
              <p>
                Today, Trail is used by thousands of researchers, analysts, and
                teams who value organized thinking. We&apos;re still a small
                team, still focused on the core problem, and still building the
                tool we want to use every day.
              </p>
            </div>
          </SurfaceCard>
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}

function AboutCtaSection() {
  return (
    <PageSection spacing="spacious">
      <SectionContainer size="md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-stroke/40 bg-surface/70 p-8 text-center md:p-12"
        >
          <GlowingEffect
            spread={60}
            glow={true}
            disabled={false}
            proximity={80}
            inactiveZone={0.01}
            borderWidth={2}
          />

          <div className="relative">
            <IconChip accent className="mx-auto h-14 w-14">
              <Globe className="h-7 w-7" />
            </IconChip>
            <h2 className="mt-6 text-2xl font-semibold text-ink md:text-3xl">
              Join our journey
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-ink-muted">
              We&apos;re always looking for feedback, partnerships, and talented
              people who care about research workflows.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button.AsChild>
                <Link href="/downloads" className="flex items-center">
                  Try Trail Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button.AsChild>
              <Button.AsChild variant="outline">
                <Link href="/contact">Get in Touch</Link>
              </Button.AsChild>
            </div>
          </div>
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}

export function AboutContent() {
  return (
    <MarketingPageShell>
      <AboutHeroSection />
      <MissionSection />
      <ValuesSection />
      <StorySection />
      <AboutCtaSection />
    </MarketingPageShell>
  );
}
