import { marketingCopy } from "@trail/content";
import { Card, SectionHeading } from "@trail/ui";
import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingNav } from "../components/MarketingNav";

export default function FaqPage() {
  const { faq } = marketingCopy;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <MarketingNav />
      <main className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeading
          kicker="FAQ"
          title={faq.title}
          subtitle="Everything you need to know about Trail today."
        />
        <div className="mt-12 grid gap-6">
          {faq.items.map((item) => (
            <Card key={item.question} className="bg-surface/80">
              <h3 className="text-lg font-semibold">{item.question}</h3>
              <p className="mt-2 text-sm text-ink-muted">{item.answer}</p>
            </Card>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
