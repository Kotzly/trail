import { marketingCopy } from "@trail/content";

export function FeatureGrid() {
  const { features } = marketingCopy;

  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <div className="flex flex-col gap-4">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-subtle">
          {features.eyebrow}
        </span>
        <h2 className="font-display text-3xl font-semibold text-ink md:text-4xl">
          {features.title}
        </h2>
        <p className="max-w-2xl text-sm text-ink-subtle">{features.summary}</p>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {features.cards.map((card) => (
          <div
            key={card.title}
            className="rounded-3xl border border-stroke/40 bg-surface/90 p-6 shadow-card"
          >
            <h3 className="font-display text-xl font-semibold text-ink">{card.title}</h3>
            <p className="mt-3 text-sm text-ink-subtle">{card.copy}</p>
            <ul className="mt-5 space-y-3 text-sm text-ink">
              {card.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-ink" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
