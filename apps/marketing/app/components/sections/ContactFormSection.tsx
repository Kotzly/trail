"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Send } from "@trail/ui/icons";
import { Button } from "@trail/ui";
import { GlowingEffect } from "../ui/glowing-effect";
import {
  LabelledInput,
  LabelledSelect,
  LabelledTextarea,
  PageSection,
  SectionContainer,
} from "../../shared/marketing-primitives";

interface ContactFormSectionProps {
  title?: string;
  description?: string;
  submitLabel?: string;
  successTitle?: string;
  successMessage?: string;
  subjects?: { label: string; value: string }[];
}

export function ContactFormSection({
  title = "Send us a message",
  description = "Fill out the form below and we'll get back to you within 24 hours.",
  submitLabel = "Send Message",
  successTitle = "Message sent!",
  successMessage = "Thanks for reaching out. We'll get back to you within 24 hours.",
  subjects,
}: ContactFormSectionProps) {
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

  const defaultSubjects = [
    { label: "General Inquiry", value: "general" },
    { label: "Technical Support", value: "support" },
    { label: "Sales / Enterprise", value: "sales" },
    { label: "Partnership", value: "partnership" },
    { label: "Press / Media", value: "press" },
    { label: "Other", value: "other" },
  ];

  const subjectOptions = subjects ?? defaultSubjects;

  return (
    <PageSection spacing="default">
      <SectionContainer size="md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
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
                <h2 className="text-xl font-semibold text-ink">{title}</h2>
                {description && (
                  <p className="mt-1 text-sm text-ink-muted">{description}</p>
                )}
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <LabelledInput
                  label="Name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Your name"
                />
                <LabelledInput
                  label="Email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="you@example.com"
                />
              </div>
              <LabelledSelect
                label="Subject"
                required
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
              >
                <option value="">Select a topic</option>
                {subjectOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </LabelledSelect>
              <LabelledTextarea
                label="Message"
                required
                rows={5}
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                placeholder="How can we help?"
              />
              <Button type="submit" size="lg" className="w-full">
                <Send className="mr-2 h-4 w-4" />
                {submitLabel}
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
                {successTitle}
              </h3>
              <p className="mt-2 text-ink-muted">{successMessage}</p>
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
