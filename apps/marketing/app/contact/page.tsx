"use client";

import { useState, Suspense } from "react";
import { motion } from "framer-motion";
import { Mail, MessageSquare, HelpCircle, ArrowRight, Send, CheckCircle2 } from "lucide-react";
import { BackgroundArt, Button } from "@trail/ui";
import { GlowingEffect } from "../components/ui/glowing-effect";
import { ContactLoading } from "../components/page-wrapper";

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

function ContactContent() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-base text-ink">
      <main className="relative overflow-hidden">
        <BackgroundArt variant="grid" className="opacity-50" />
        
        {/* Hero */}
        <section className="relative px-6 pt-20 pb-8">
          <div className="mx-auto max-w-4xl text-center">
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
              Have a question, feedback, or just want to say hello? We&apos;d love to hear from you.
            </motion.p>
          </div>
        </section>

        {/* Contact Methods */}
        <section className="relative px-6 py-8">
          <div className="mx-auto max-w-6xl">
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
                    className="group rounded-3xl border border-stroke/40 bg-surface/50 p-6 transition-all hover:border-accent/30 hover:bg-surface/70 hover:shadow-lg"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 transition-transform group-hover:scale-110">
                      <Icon className="h-6 w-6 text-accent" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-ink">{method.title}</h3>
                    <p className="mt-1 text-sm font-medium text-accent">{method.email}</p>
                    <p className="mt-2 text-sm text-ink-muted">{method.description}</p>
                  </motion.a>
                );
              })}
            </div>
          </div>
        </section>

        {/* Contact Form */}
        <section className="relative px-6 py-12">
          <div className="mx-auto max-w-2xl">
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
                    <h2 className="text-xl font-semibold text-ink">Send us a message</h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      Fill out the form below and we&apos;ll get back to you within 24 hours.
                    </p>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-ink">Name</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="h-12 w-full rounded-xl border border-stroke/60 bg-surface px-4 text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-ink">Email</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="h-12 w-full rounded-xl border border-stroke/60 bg-surface px-4 text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-ink">Subject</label>
                    <select
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="h-12 w-full rounded-xl border border-stroke/60 bg-surface px-4 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                    >
                      <option value="">Select a topic</option>
                      <option value="general">General Inquiry</option>
                      <option value="support">Technical Support</option>
                      <option value="sales">Sales / Enterprise</option>
                      <option value="partnership">Partnership</option>
                      <option value="press">Press / Media</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-ink">Message</label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full rounded-xl border border-stroke/60 bg-surface px-4 py-3 text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                      placeholder="How can we help?"
                    />
                  </div>

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
                  <h3 className="mt-4 text-xl font-semibold text-ink">Message sent!</h3>
                  <p className="mt-2 text-ink-muted">
                    Thanks for reaching out. We&apos;ll get back to you within 24 hours.
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
          </div>
        </section>

        {/* Quick Links */}
        <section className="relative px-6 py-12">
          <div className="mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="rounded-3xl border border-stroke/40 bg-surface/50 p-8"
            >
              <h2 className="text-center text-lg font-semibold text-ink">
                Looking for something else?
              </h2>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button variant="outline">
                  <a href="/faq" className="flex items-center">
                    Visit FAQ
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button variant="outline">
                  <a href="/support" className="flex items-center">
                    Support Center
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button variant="outline">
                  <a href="/about" className="flex items-center">
                    About Us
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<ContactLoading />}>
      <ContactContent />
    </Suspense>
  );
}
