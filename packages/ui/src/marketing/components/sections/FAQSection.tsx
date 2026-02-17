"use client";

import { motion } from "motion/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";

interface FAQSectionProps {
  eyebrow?: string;
  title?: string;
  items?: readonly { question: string; answer: string; category?: string }[];
}

export function FAQSection(props: FAQSectionProps) {
  const faq = {
    eyebrow: props.eyebrow ?? "FAQ",
    title: props.title ?? "Frequently asked questions",
    items: props.items ?? [],
  };

  return (
    <section id="faq" className="relative px-6 py-24">
      <div className="mx-auto max-w-3xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-accent">
            {faq.eyebrow}
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            {faq.title}
          </h2>
        </motion.div>

        {/* FAQ Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Accordion type="single" collapsible className="w-full">
            {faq.items.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left font-medium text-ink hover:text-accent">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-ink-muted">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
