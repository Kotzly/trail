import type { CSSProperties } from "react";

import { marketingCopy } from "@trail/content";
import { Badge } from "@trail/ui";

export function MarketingHero() {
  const { hero } = marketingCopy;
  const words = hero.words;
  const wordCount = words.length;
  const transitionCount = Math.max(wordCount, 1);
  const loopWords = wordCount > 0 ? [...words, words[0]] : words;
  const segment = 100 / transitionCount;
  const holdFraction = 0.62;
  const bounceFraction = 0.82;
  const bounceOffset = 12;
  const animationName = `word-slide-${transitionCount}`;
  const animationDuration = `${transitionCount * 2}s`;
  const keyframeStops = Array.from({ length: transitionCount }, (_, index) => {
    const start = (segment * index).toFixed(4);
    const hold = (segment * index + segment * holdFraction).toFixed(4);
    const bounce = (segment * index + segment * bounceFraction).toFixed(4);
    const next = (segment * (index + 1)).toFixed(4);
    const currentOffset = `-${index * 100}%`;
    const nextOffset = `-${(index + 1) * 100}%`;
    const bounceOffsetValue = `calc(${nextOffset} - ${bounceOffset}%)`;
    return [
      `${start}% { transform: translateY(${currentOffset}); }`,
      `${hold}% { transform: translateY(${currentOffset}); }`,
      `${bounce}% { transform: translateY(${bounceOffsetValue}); }`,
      `${next}% { transform: translateY(${nextOffset}); }`,
    ].join("\n");
  }).join("\n");
  const keyframes = `@keyframes ${animationName} {
${keyframeStops}
}`;
  const shouldAnimate = transitionCount > 1;
  const wordVars = {
    "--word-animation-name": shouldAnimate ? animationName : "none",
    "--word-animation-duration": shouldAnimate ? animationDuration : "0s",
    "--word-animation-easing": "cubic-bezier(0.34, 1.56, 0.64, 1)",
  } as CSSProperties;

  return (
    <section className="relative overflow-hidden px-6 pb-12 pt-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-16 h-40 w-40 rounded-full bg-ink/5 blur-3xl" />
        <div className="absolute -right-10 top-40 h-56 w-56 rounded-full bg-ink/10 blur-3xl float-slow" />
        <div className="absolute bottom-10 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-ink/5 blur-3xl float-slower" />
      </div>
      <div className="mx-auto max-w-6xl text-center">
        <div className="space-y-6">
          <Badge className="border border-stroke/40 bg-surface/70 text-xs font-semibold uppercase tracking-[0.3em] text-ink-subtle">
            {hero.pill}
          </Badge>
          <h1 className="font-display text-4xl font-semibold leading-tight text-ink md:text-6xl">
            <span className="block text-ink-muted">{hero.lead}</span>
            <span className="mt-2 flex justify-center text-ink">
              <span className="word-rotator" style={wordVars}>
                <span className="word-rotator-track">
                  {loopWords.map((word, index) => (
                    <span key={`${word}-${index}`}>{word}</span>
                  ))}
                </span>
              </span>
            </span>
          </h1>
          <style dangerouslySetInnerHTML={{ __html: keyframes }} />
          <p className="mx-auto max-w-2xl text-[1rem] text-ink-muted">{hero.summary}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/downloads"
              className="cta-primary inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold shadow-card transition hover:bg-ink-muted"
            >
              {hero.ctaPrimary}
            </a>
            <a
              href="/#showcase"
              className="inline-flex items-center gap-2 rounded-full border border-stroke/60 px-6 py-3 text-sm font-semibold text-ink transition hover:border-stroke"
            >
              {hero.ctaSecondary}
            </a>
          </div>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {marketingCopy.stats.map((stat) => (
            <div key={stat.label} className="trail-card-compact p-4 text-left">
              <div className="text-2xl font-semibold text-ink">{stat.value}</div>
              <div className="mt-1 text-xs text-ink-subtle">{stat.label}</div>
            </div>
          ))}
        </div>
        {marketingCopy.statsNote ? (
          <p className="mt-4 text-xs text-ink-subtle">{marketingCopy.statsNote}</p>
        ) : null}
      </div>
    </section>
  );
}
