"use client";

import { motion } from "framer-motion";
import { Suspense } from "react";
import { LifeBuoy, Clock, Mail, MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@trail/ui";
import { SupportFlow } from "./SupportFlow";
import { SupportLoading } from "../components/page-wrapper";

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
];

function SupportContent() {
  return (
    <div className="min-h-screen bg-base text-ink">
      <main className="relative overflow-hidden">
        {/* Hero */}
        <section className="relative px-6 pt-20 pb-8">
          <div className="mx-auto max-w-4xl text-center">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-accent"
            >
              <LifeBuoy className="h-3.5 w-3.5" />
              Support
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-6 font-display text-4xl font-semibold leading-[1.15] tracking-tight text-ink md:text-5xl"
            >
              How can we help?
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted"
            >
              Get unstuck with our support tools, troubleshooting guides, and
              direct help from our team.
            </motion.p>
          </div>
        </section>

        {/* Support Options */}
        <section className="relative px-6 py-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-6 md:grid-cols-3">
              {supportOptions.map((option, index) => {
                const Icon = option.icon;
                return (
                  <motion.div
                    key={option.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                    className="group rounded-3xl border border-stroke/40 bg-surface/50 p-6 hover:border-accent/30 hover:bg-surface/70 hover:shadow-lg"
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                        option.primary
                          ? "bg-accent/10 text-accent"
                          : "bg-surface-strong text-ink-muted"
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-ink">
                      {option.title}
                    </h3>
                    <p className="mt-2 text-sm text-ink-muted">
                      {option.description}
                    </p>
                    <Button
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
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Interactive Support Flow */}
        <section className="relative px-6 py-12">
          <div className="mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <SupportFlow />
            </motion.div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="relative px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
            >
              {[
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
              ].map((link) => (
                <a
                  key={link.title}
                  href={link.href}
                  className="group rounded-2xl border border-stroke/40 bg-surface/30 p-5 transition-all hover:border-accent/30 hover:bg-surface/50"
                >
                  <h3 className="font-medium text-ink group-hover:text-accent">
                    {link.title}
                  </h3>
                  <p className="mt-1 text-sm text-ink-subtle">{link.desc}</p>
                </a>
              ))}
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<SupportLoading />}>
      <SupportContent />
    </Suspense>
  );
}
