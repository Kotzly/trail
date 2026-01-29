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
          <span className="trail-eyebrow text-ink-subtle">FAQ</span>
          <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">{faq.title}</h1>
          <p className="text-sm text-ink-subtle">Everything you need to know about Trail today.</p>
        </div>
        <div className="mt-12 space-y-3">
          {faq.items.map((item) => (
            <details
              key={item.question}
              className="group rounded-3xl border border-stroke/30 bg-surface/60 px-6 py-4 shadow-elev-1 backdrop-blur-sm reveal"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="font-display text-base font-semibold text-ink">{item.question}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-stroke/60 bg-surface/70 text-ink/70 transition group-open:rotate-180">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm text-ink-subtle">{item.answer}</p>
            </details>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
