import { marketingCopy } from "@trail/content";

export function FeatureGrid() {
  const { features } = marketingCopy;

  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <div className="flex flex-col gap-4">
        <span className="trail-eyebrow">{features.eyebrow}</span>
        <h2 className="trail-title">{features.title}</h2>
        <p className="trail-copy max-w-2xl">{features.summary}</p>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {features.cards.map((card) => (
          <div
            key={card.title}
            className="trail-card p-6"
          >
            <h3 className="font-display text-xl font-semibold text-ink">{card.title}</h3>
            <p className="trail-copy mt-3">{card.copy}</p>
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
