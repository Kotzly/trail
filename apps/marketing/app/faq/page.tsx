import { marketingCopy } from "@trail/content";
import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingNav } from "../components/MarketingNav";

export default function FaqPage() {
  const { faq } = marketingCopy;

  return (
    <div className="min-h-screen bg-base text-ink">
      <MarketingNav />
      <main className="mx-auto max-w-5xl px-6 py-20">
        <div className="flex flex-col gap-4">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-subtle">FAQ</span>
          <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">{faq.title}</h1>
          <p className="text-sm text-ink-subtle">Everything you need to know about Trail today.</p>
        </div>
        <div className="mt-12 grid gap-6">
          {faq.items.map((item) => (
            <div
              key={item.question}
              className="rounded-3xl border border-stroke/40 bg-surface/90 p-6 shadow-card"
            >
              <h3 className="font-display text-lg font-semibold text-ink">{item.question}</h3>
              <p className="mt-2 text-sm text-ink-subtle">{item.answer}</p>
            </div>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
