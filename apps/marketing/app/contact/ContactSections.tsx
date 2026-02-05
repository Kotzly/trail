"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Mail,
  MessageSquare,
  Send,
} from "lucide-react";
import { Button } from "@trail/ui";
import { GlowingEffect } from "../components/ui/glowing-effect";
import {
  IconChip,
  LabelledInput,
  LabelledSelect,
  LabelledTextarea,
  MarketingPageShell,
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../shared/marketing-primitives";

const contactMethods = [
  {
    icon: Mail,
    title: "General Inquiries",
    email: "hello@gettrail.net",
    description: "For partnerships, press, and general questions.",
  },
  {
    icon: HelpCircle,
    title: "Support",
    email: "support@gettrail.net",
    description: "Get help with technical issues or account questions.",
  },
  {
    icon: MessageSquare,
    title: "Feedback",
    email: "feedback@gettrail.net",
    description: "Share your thoughts and feature requests.",
  },
];

function ContactHeroSection() {
  return (
    <PageSection spacing="hero">
      <SectionContainer size="md" className="text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-accent"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Contact
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 font-display text-4xl font-semibold leading-[1.15] tracking-tight text-ink md:text-5xl"
        >
          Get in touch
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted"
        >
          Have a question, feedback, or just want to say hello? We&apos;d love
          to hear from you.
        </motion.p>
      </SectionContainer>
    </PageSection>
  );
}

function ContactMethodsSection() {
  return (
    <PageSection spacing="compact">
      <SectionContainer size="lg">
        <div className="grid gap-6 md:grid-cols-3">
          {contactMethods.map((method, index) => {
            const Icon = method.icon;
            return (
              <motion.a
                key={method.title}
                href={`mailto:${method.email}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
              >
                <SurfaceCard interactive className="group p-6">
                  <IconChip accent className="transition-transform group-hover:scale-110">
                    <Icon className="h-6 w-6" />
                  </IconChip>
                  <h3 className="mt-4 text-lg font-semibold text-ink">
                    {method.title}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-accent">
                    {method.email}
                  </p>
                  <p className="mt-2 text-sm text-ink-muted">
                    {method.description}
                  </p>
                </SurfaceCard>
              </motion.a>
            );
          })}
        </div>
      </SectionContainer>
    </PageSection>
  );
}

function ContactFormSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <PageSection spacing="default">
      <SectionContainer size="md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-stroke/40 bg-surface/70 p-8"
        >
          <GlowingEffect
            spread={40}
            glow={true}
            disabled={false}
            proximity={60}
            inactiveZone={0.01}
            borderWidth={2}
          />

          {!submitted ? (
            <form onSubmit={handleSubmit} className="relative space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-ink">
                  Send us a message
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Fill out the form below and we&apos;ll get back to you within
                  24 hours.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <LabelledInput
                  label="Name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(event) =>
                    setFormData({ ...formData, name: event.target.value })
                  }
                  placeholder="Your name"
                />
                <LabelledInput
                  label="Email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(event) =>
                    setFormData({ ...formData, email: event.target.value })
                  }
                  placeholder="you@example.com"
                />
              </div>

              <LabelledSelect
                label="Subject"
                required
                value={formData.subject}
                onChange={(event) =>
                  setFormData({ ...formData, subject: event.target.value })
                }
              >
                <option value="">Select a topic</option>
                <option value="general">General Inquiry</option>
                <option value="support">Technical Support</option>
                <option value="sales">Sales / Enterprise</option>
                <option value="partnership">Partnership</option>
                <option value="press">Press / Media</option>
                <option value="other">Other</option>
              </LabelledSelect>

              <LabelledTextarea
                label="Message"
                required
                rows={5}
                value={formData.message}
                onChange={(event) =>
                  setFormData({ ...formData, message: event.target.value })
                }
                placeholder="How can we help?"
              />

              <Button type="submit" size="lg" className="w-full">
                <Send className="mr-2 h-4 w-4" />
                Send Message
              </Button>
            </form>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative py-12 text-center"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-ink">
                Message sent!
              </h3>
              <p className="mt-2 text-ink-muted">
                Thanks for reaching out. We&apos;ll get back to you within 24
                hours.
              </p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => setSubmitted(false)}
              >
                Send another message
              </Button>
            </motion.div>
          )}
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}

function ContactQuickLinksSection() {
  const quickLinks = [
    { label: "Visit FAQ", href: "/faq" },
    { label: "Support Center", href: "/support" },
    { label: "About Us", href: "/about" },
  ];

  return (
    <PageSection spacing="default">
      <SectionContainer size="md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <SurfaceCard className="p-8">
            <h2 className="text-center text-lg font-semibold text-ink">
              Looking for something else?
            </h2>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {quickLinks.map((link) => (
                <Button.AsChild key={link.href} variant="outline">
                  <Link href={link.href} className="flex items-center">
                    {link.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button.AsChild>
              ))}
            </div>
          </SurfaceCard>
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}

export function ContactContent() {
  return (
    <MarketingPageShell>
      <ContactHeroSection />
      <ContactMethodsSection />
      <ContactFormSection />
      <ContactQuickLinksSection />
    </MarketingPageShell>
  );
}
