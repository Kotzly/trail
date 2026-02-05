"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, HelpCircle, MessageCircle, Search } from "lucide-react";
import { marketingCopy } from "@trail/content";
import { Button } from "@trail/ui";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
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
    answer:
      "No. Trail only captures URLs, page titles, and your notes. We never read or store page content, cookies, or form data.",
  },
  {
    category: "features",
    question: "Can I export my trails?",
    answer:
      "Yes! You can export your trails as Markdown, PDF, or JSON. Pro and Team plans include additional export formats.",
  },
  {
    category: "billing",
    question: "Do you offer refunds?",
    answer:
      "Yes, we offer a 7-day money-back guarantee for all paid plans. No questions asked.",
  },
  {
    category: "technical",
    question: "Does Trail work offline?",
    answer:
      "Trail captures locally first and syncs when you're back online. Your research never gets lost.",
  },
  {
    category: "features",
    question: "Can I share trails with non-users?",
    answer:
      "Yes, you can generate shareable links that anyone can view, even without a Trail account.",
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

function CategoryFilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-accent px-4 py-2 text-sm font-medium text-cta-fg"
          : "rounded-full border border-stroke/40 bg-surface/50 px-4 py-2 text-sm font-medium text-ink-subtle transition-all hover:border-accent/30 hover:text-ink"
      }
    >
      {label}
    </button>
  );
}

export function FAQContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const allFaqs = [...marketingCopy.faq.items, ...additionalFaqs];

  const filteredFaqs = allFaqs.filter((faq) => {
    const query = debouncedQuery.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 || faq.question.toLowerCase().includes(query);
    const matchesCategory =
      activeCategory === "all" || faq.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <MarketingPageShell>
      <PageSection spacing="hero">
        <SectionContainer size="md" className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <HeroBadge>
              <HelpCircle className="h-3.5 w-3.5" />
              Help Center
            </HeroBadge>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <HeroTitle className="md:text-5xl lg:text-5xl">
              Frequently asked questions
            </HeroTitle>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <HeroSubtitle>
              Everything you need to know about Trail. Can&apos;t find what
              you&apos;re looking for? Reach out to our support team.
            </HeroSubtitle>
          </motion.div>

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
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-14 w-full rounded-full border border-stroke/60 bg-surface pl-12 pr-4 text-ink placeholder:text-ink-subtle shadow-lg shadow-accent/5 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-2"
          >
            {categories.map((category) => (
              <CategoryFilterButton
                key={category.id}
                active={activeCategory === category.id}
                label={category.label}
                onClick={() => setActiveCategory(category.id)}
              />
            ))}
          </motion.div>
        </SectionContainer>
      </PageSection>

      <PageSection spacing="default">
        <SectionContainer size="sm">
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
        </SectionContainer>
      </PageSection>

      <PageSection spacing="spacious">
        <SectionContainer size="md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <SurfaceCard className="relative overflow-hidden bg-surface/70 p-8 md:p-12">
              <div className="relative flex flex-col items-center text-center md:flex-row md:text-left">
                <div className="flex-1">
                  <IconChip accent className="h-14 w-14">
                    <MessageCircle className="h-7 w-7" />
                  </IconChip>
                  <h2 className="mt-4 text-2xl font-semibold text-ink">
                    Still have questions?
                  </h2>
                  <p className="mt-2 text-ink-muted">
                    Our support team is here to help. Reach out and we&apos;ll
                    get back to you within 24 hours.
                  </p>
                </div>
                <div className="mt-6 flex flex-col gap-3 md:ml-8 md:mt-0">
                  <Button.AsChild>
                    <a href="mailto:support@gettrail.net" className="flex items-center">
                      Email Support
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button.AsChild>
                  <Button.AsChild variant="outline">
                    <a href="/support">Visit Help Center</a>
                  </Button.AsChild>
                </div>
              </div>
            </SurfaceCard>
          </motion.div>
        </SectionContainer>
      </PageSection>
    </MarketingPageShell>
  );
}
