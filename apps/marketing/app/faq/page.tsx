import { marketingCopy } from "@trail/content";
import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingNav } from "../components/MarketingNav";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "../components/ui/accordion";

export default function FaqPage() {
  const { faq } = marketingCopy;

  return (
    <div className="min-h-screen bg-base text-ink">
      <MarketingNav />
      <main className="mx-auto max-w-5xl px-6 py-20">
        <div className="flex flex-col gap-4">
          <span className="trail-eyebrow text-ink-subtle">FAQ</span>
          <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">{faq.title}</h1>
          <p className="text-sm text-ink-subtle">Everything you need to know about Trail today.</p>
        </div>
        <div className="mt-12">
          <Accordion type="single" collapsible className="space-y-3">
            {faq.items.map((item) => (
              <AccordionItem
                key={item.question}
                value={item.question}
                className="rounded-3xl border border-stroke/30 bg-surface/60 px-6 py-2 shadow-elev-1 backdrop-blur-sm reveal"
              >
                <AccordionTrigger className="text-base text-ink">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-ink-subtle">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
