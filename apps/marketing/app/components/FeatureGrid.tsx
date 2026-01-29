import type { CSSProperties } from "react";

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
      <div className="mt-12 grid gap-8">
        {features.cards.map((card, index) => (
          <div
            key={card.title}
            className="group relative overflow-hidden rounded-[32px] border border-stroke/30 bg-surface/60 p-8 shadow-elev-1 backdrop-blur-sm reveal"
            style={{ "--reveal-delay": `${index * 0.08}s` } as CSSProperties}
          >
            <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="text-xs font-semibold tracking-[0.12em] text-ink-subtle">
                  0{index + 1}
                </p>
                <h3 className="mt-3 font-display text-2xl font-semibold text-ink">
                  {card.title}
                </h3>
                <p className="trail-copy mt-3">{card.copy}</p>
              </div>
              <ul className="space-y-3 text-sm text-ink">
                {card.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3">
                    <span className="mt-2 h-2 w-2 rounded-full bg-ink/70" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
