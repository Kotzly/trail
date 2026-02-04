"use client";

import { useState, Suspense, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, HelpCircle, MessageCircle, ArrowRight } from "lucide-react";
import { marketingCopy } from "@trail/content";
import { Button } from "@trail/ui";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import { FAQLoading } from "../components/page-wrapper";

const categories = [
  { id: "all", label: "All Questions" },
  { id: "privacy", label: "Privacy & Security" },
  { id: "features", label: "Features" },
  { id: "billing", label: "Billing" },
  { id: "technical", label: "Technical" },
];

const additionalFaqs = [
  {
    category: "privacy",
    question: "Does Trail read my page content?",
    answer: "No. Trail only captures URLs, page titles, and your notes. We never read or store page content, cookies, or form data.",
  },
  {
    category: "features",
    question: "Can I export my trails?",
    answer: "Yes! You can export your trails as Markdown, PDF, or JSON. Pro and Team plans include additional export formats.",
  },
  {
    category: "billing",
    question: "Do you offer refunds?",
    answer: "Yes, we offer a 7-day money-back guarantee for all paid plans. No questions asked.",
  },
  {
    category: "technical",
    question: "Does Trail work offline?",
    answer: "Trail captures locally first and syncs when you're back online. Your research never gets lost.",
  },
  {
    category: "features",
    question: "Can I share trails with non-users?",
    answer: "Yes, you can generate shareable links that anyone can view, even without a Trail account.",
  },
];

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}


function FAQContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  const allFaqs = [...marketingCopy.faq.items, ...additionalFaqs];

  const filteredFaqs = allFaqs.filter((faq) => {
    const q = debouncedQuery.trim().toLowerCase();
  
    const matchesSearch =
      q.length === 0 ||
      faq.question.toLowerCase().includes(q)
  
    const matchesCategory =
      activeCategory === "all" || faq.category === activeCategory;
  
    return matchesSearch && matchesCategory;
  });  

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
              <HelpCircle className="h-3.5 w-3.5" />
              Help Center
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-6 font-display text-4xl font-semibold leading-[1.15] tracking-tight text-ink md:text-5xl"
            >
              Frequently asked questions
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted"
            >
              Everything you need to know about Trail. Can&apos;t find what you&apos;re looking for? Reach out to our support team.
            </motion.p>

            {/* Search */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="relative mx-auto mt-8 max-w-xl"
            >
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-14 w-full rounded-full border border-stroke/60 bg-surface pl-12 pr-4 text-ink placeholder:text-ink-subtle shadow-lg shadow-accent/5 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </motion.div>

            {/* Categories */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-6 flex flex-wrap items-center justify-center gap-2"
            >
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    activeCategory === category.id
                      ? "bg-accent text-cta-fg"
                      : "border border-stroke/40 bg-surface/50 text-ink-subtle hover:border-accent/30 hover:text-ink"
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </motion.div>
          </div>
        </section>

        {/* FAQ List */}
        <section className="relative px-6 py-12">
          <div className="mx-auto max-w-3xl">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${activeCategory}:${debouncedQuery}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <Accordion type="single" collapsible className="space-y-3">
                  {filteredFaqs.map((item) => (
                    <AccordionItem
                      key={item.question}
                      value={item.question}
                      className="rounded-2xl border border-stroke/40 bg-surface/50 px-6 transition-all hover:border-accent/30 hover:bg-surface/70"
                    >
                      <AccordionTrigger className="text-left text-base font-medium text-ink hover:text-accent [&[data-state=open]>svg]:rotate-180">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 text-sm leading-relaxed text-ink-muted">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* Still have questions */}
        <section className="relative px-6 py-16">
          <div className="mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative overflow-hidden rounded-3xl border border-stroke/40 bg-surface/70 p-8 md:p-12"
            >
              <div className="relative flex flex-col items-center text-center md:flex-row md:text-left">
                <div className="flex-1">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                    <MessageCircle className="h-7 w-7 text-accent" />
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-ink">
                    Still have questions?
                  </h2>
                  <p className="mt-2 text-ink-muted">
                    Our support team is here to help. Reach out and we&apos;ll get back to you within 24 hours.
                  </p>
                </div>
                <div className="mt-6 flex flex-col gap-3 md:mt-0 md:ml-8">
                  <Button>
                    <a href="mailto:support@gettrail.net" className="flex items-center">
                      Email Support
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                  <Button variant="outline">
                    <a href="/support">Visit Help Center</a>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function FAQPage() {
  return (
    <Suspense fallback={<FAQLoading />}>
      <FAQContent />
    </Suspense>
  );
}
